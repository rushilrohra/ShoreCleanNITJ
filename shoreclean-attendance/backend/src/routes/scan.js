const express = require('express');
const jwt = require('jsonwebtoken');

const { query } = require('../config/db');
const { verifyVolunteerToken, verifyUserToken } = require('../middleware/auth');

const router = express.Router();

router.post('/verify', verifyUserToken, async (req, res) => {
  if (req.user.role !== 'organizer' && req.user.role !== 'admin' && req.user.role !== 'ngo') {
    return res.status(403).json({ error: 'Access denied. Only organizer/NGO/admin can verify registrations.' });
  }
  try {
    const { qr_token } = req.body;
    const normalizedToken = typeof qr_token === 'string' ? qr_token.trim() : '';

    if (!normalizedToken) {
      return res.status(400).json({ error: 'qr_token is required' });
    }

    // Step 1: Best-effort JWT check (do not hard-fail here).
    // DB token lookup remains the source of truth for scan validity.
    try {
      jwt.verify(normalizedToken, process.env.QR_SECRET);
    } catch (err) {
      console.warn('QR verify warning (continuing with DB lookup):', err.message);
    }

    // Step 2: Fetch registration + user + event details in one query
    const result = await query(
      `
        SELECT
          r.id          AS reg_id,
          r.status,
          r.photo_url,
          r.registered_at,
          u.id          AS user_id,
          u.first_name || ' ' || COALESCE(u.last_name, '') AS volunteer_name,
          u.email       AS volunteer_email,
          u.phone       AS volunteer_phone,
          e.title       AS event_title,
          e.location_name AS beach_name,
          e.event_date,
          e.start_time
        FROM event_registrations r
        JOIN users  u ON r.user_id   = u.id
        JOIN events e ON r.event_id  = e.id
        WHERE r.qr_token = $1
      `,
      [normalizedToken]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const reg = result.rows[0];

    // Step 3: Block if not in a scannable state
    if (reg.status !== 'PENDING') {
      const messages = {
        ACTIVE: 'Already checked in',
        DONE: 'Already completed',
        REJECTED: 'Rejected by organizer',
        CANCELLED: 'Registration cancelled by volunteer',
        ABSENT: 'Marked absent',
      };
      return res.status(409).json({
        error: messages[reg.status] || 'Cannot process this registration',
        status: reg.status,
      });
    }

    // Step 4: Return full details for organizer to verify
    return res.status(200).json({
      reg_id: reg.reg_id,
      status: reg.status,
      photo_url: reg.photo_url,
      volunteer_name: reg.volunteer_name,
      volunteer_email: reg.volunteer_email,
      volunteer_phone: reg.volunteer_phone,
      event_title: reg.event_title,
      beach_name: reg.beach_name,
      event_date: reg.event_date,
      registered_at: reg.registered_at,
      qr_token: normalizedToken,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

router.post('/reject', verifyUserToken, async (req, res) => {
  if (req.user.role !== 'organizer' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Only organizers can reject registrations.' });
  }
  try {
    const { reg_id } = req.body;
    if (!reg_id) {
      return res.status(400).json({ error: 'reg_id required' });
    }

    const result = await query(
      `UPDATE event_registrations SET status = 'REJECTED' WHERE id = $1 AND status = 'PENDING' RETURNING *`,
      [reg_id]
    );

    if (!result.rows[0]) {
      return res.status(409).json({ error: 'Registration not found or already processed' });
    }

    return res.status(200).json({ success: true, message: 'Entry rejected' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Rejection failed' });
  }
});

router.post('/', verifyVolunteerToken, async (req, res) => {
  try {
    // STEP 1 - Validate input
    const { qr_token, event_id: selected_event_id } = req.body;
    let { scan_type } = req.body;
    const normalizedToken = typeof qr_token === 'string' ? qr_token.trim() : '';

    if (!normalizedToken) {
      return res.status(400).json({ message: 'qr_token is required' });
    }

    // STEP 2 - Database lookup by qr_token
    const registrationResult = await query(
      `
        SELECT r.*, u.first_name || ' ' || COALESCE(u.last_name, '') as volunteer_name, e.title as event_title, e.event_date
        FROM event_registrations r
        JOIN users u ON r.user_id = u.id
        JOIN events e ON r.event_id = e.id
        WHERE r.qr_token = $1
      `,
      [normalizedToken]
    );

    if (registrationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const registration = registrationResult.rows[0];

    // Only auto-detect when client did not provide a valid scan_type.
    // This avoids accidental checkout while operator is on CHECK IN mode.
    if (registration.status === 'DONE') {
      return res.status(200).json({
        success: true,
        already_done: true,
        volunteer_name: registration.volunteer_name,
        certificate_url: registration.certificate_url,
        message: '✓ Impact already recorded & verified'
      });
    }

    if (scan_type !== 'checkin' && scan_type !== 'checkout') {
      if (registration.status === 'PENDING') {
        scan_type = 'checkin';
      } else if (registration.status === 'ACTIVE') {
        scan_type = 'checkout';
      }
    }

    const selectedEventMismatch =
      Boolean(selected_event_id) && registration.event_id !== selected_event_id;

    // STEP 3 - Validate event date
    const enforceEventDate =
      process.env.ENFORCE_EVENT_DATE === 'true' ||
      (process.env.ENFORCE_EVENT_DATE !== 'false' && process.env.NODE_ENV === 'production');

    if (enforceEventDate) {
      const dateCheckResult = await query(
        'SELECT event_date = CURRENT_DATE AS is_today FROM events WHERE id = $1',
        [registration.event_id]
      );

      if (dateCheckResult.rows.length === 0) {
        return res.status(404).json({ message: 'Event not found' });
      }

      if (!dateCheckResult.rows[0].is_today) {
        return res.status(400).json({ message: "This QR is not valid for today's event" });
      }
    }

    // STEP 4 - State machine
    if (scan_type === 'checkin') {
      if (!['PENDING'].includes(registration.status)) {
        if (registration.status === 'ACTIVE' && !registration.entry_time) {
          // Recovery path for old/inconsistent rows: ACTIVE without entry_time.
          const repaired = await query(
            `
              UPDATE event_registrations
              SET entry_time = NOW()
              WHERE id = $1
              RETURNING entry_time
            `,
            [registration.id]
          );

          return res.status(200).json({
            success: true,
            volunteer_name: registration.volunteer_name,
            message: '✓ Check-in successful',
            entry_time: repaired.rows[0].entry_time,
          });
        }

        const msg = {
          ACTIVE: 'Already checked in',
          DONE: 'Already completed',
          REJECTED: 'This registration was rejected by the organizer',
          CANCELLED: 'This registration was cancelled by the volunteer',
          ABSENT: 'Marked absent',
        }[registration.status] || 'Cannot check in';

        return res.status(409).json({ error: msg });
      }

      const updateResult = await query(
        `
          UPDATE event_registrations
          SET status = 'ACTIVE', entry_time = NOW()
          WHERE id = $1
          RETURNING entry_time
        `,
        [registration.id]
      );

      return res.status(200).json({
        success: true,
        event_id: registration.event_id,
        registration_id: registration.id,
        event_title: registration.event_title,
        volunteer_name: registration.volunteer_name,
        message: selectedEventMismatch
          ? '✓ Check-in successful (scanner auto-switched to QR event)'
          : '✓ Check-in successful',
        entry_time: updateResult.rows[0].entry_time,
      });
    }

    if (registration.status !== 'ACTIVE') {
      if (registration.status === 'PENDING') {
        return res.status(409).json({ message: 'Volunteer not checked in yet' });
      }

      if (registration.status === 'DONE') {
        return res.status(409).json({ message: 'Already checked out' });
      }

      return res.status(409).json({ message: 'Invalid registration state' });
    }

    const durationResult = await query(
      `
        SELECT ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(entry_time, NOW()))) / 60)::INT AS duration_mins
        FROM event_registrations
        WHERE id = $1
      `,
      [registration.id]
    );

    const durationMins = durationResult.rows[0].duration_mins;

    const checkoutUpdate = await query(
      `
        UPDATE event_registrations
        SET status = 'DONE', exit_time = NOW(), duration_mins = $2
        WHERE id = $1
        RETURNING exit_time, duration_mins, user_id, event_id
      `,
      [registration.id, durationMins]
    );

    // --- AUTOMATED IMPACT CERTIFICATION (PHASE 4) ---
    const { generateCertificate } = require('../services/certificate');
    const { sendCertificateEmail } = require('../services/email');

    const volunteerInfo = await query(
      `
        SELECT u.first_name || ' ' || COALESCE(u.last_name, '') AS name, u.email, e.title AS event_title, e.location_name, e.event_date
        FROM users u, events e
        WHERE u.id = $1 AND e.id = $2
      `,
      [checkoutUpdate.rows[0].user_id, checkoutUpdate.rows[0].event_id]
    );

    if (volunteerInfo.rows.length > 0) {
      const details = {
        registration_id: registration.id,
        name: volunteerInfo.rows[0].name,
        email: volunteerInfo.rows[0].email,
        event_title: volunteerInfo.rows[0].event_title,
        location_name: volunteerInfo.rows[0].location_name,
        event_date: volunteerInfo.rows[0].event_date,
        duration_mins: durationMins,
      };

      // Generate and Email (fire and forget to not block the scanner response)
      generateCertificate(details)
        .then(url => {
          if (details.email) sendCertificateEmail(details.email, details.name, url);
        })
        .catch(err => console.error("Certificate Automation Error:", err));
    }

    return res.status(200).json({
      success: true,
      event_id: registration.event_id,
      registration_id: registration.id,
      event_title: registration.event_title,
      volunteer_name: registration.volunteer_name,
      message: selectedEventMismatch
        ? '✓ Check-out successful (scanner auto-switched to QR event)'
        : '✓ Check-out successful',
      duration_mins: checkoutUpdate.rows[0].duration_mins,
      exit_time: checkoutUpdate.rows[0].exit_time,
    });
  } catch (error) {
    console.error("POST /scan Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.post('/impact-log', verifyVolunteerToken, async (req, res) => {
  try {
    const {
      registration_id,
      estimated_weight_kg,
      waste_type,
      notes,
      photo_url,
    } = req.body || {};

    if (!registration_id) {
      return res.status(400).json({ message: 'registration_id is required' });
    }

    const parsedWeight = Number(estimated_weight_kg);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      return res.status(400).json({ message: 'estimated_weight_kg must be a positive number' });
    }

    const regResult = await query(
      `
        SELECT r.id, r.user_id, r.event_id, r.status
        FROM event_registrations r
        WHERE r.id = $1
        LIMIT 1
      `,
      [registration_id]
    );

    if (regResult.rows.length === 0) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const reg = regResult.rows[0];
    if (!['ACTIVE', 'DONE'].includes(reg.status)) {
      return res.status(409).json({
        message: 'Impact can only be logged after check-in or check-out',
      });
    }

    const insertResult = await query(
      `
        INSERT INTO waste_logs (
          volunteer_id,
          event_id,
          photo_url,
          waste_type,
          estimated_weight_kg,
          ai_confidence,
          ai_classification,
          verified,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW(), NOW())
        RETURNING id, volunteer_id, event_id, waste_type, estimated_weight_kg, created_at
      `,
      [
        reg.user_id,
        reg.event_id,
        String(photo_url || 'manual://scanner-impact-log'),
        String(waste_type || 'Mixed Waste').trim().slice(0, 100) || 'Mixed Waste',
        parsedWeight.toFixed(2),
        1.0,
        String(notes || 'Manual scanner impact log').trim().slice(0, 500) || 'Manual scanner impact log',
      ]
    );

    return res.status(201).json({
      success: true,
      message: 'Impact logged successfully',
      impact: insertResult.rows[0],
    });
  } catch (error) {
    console.error('POST /scan/impact-log Error:', error);
    return res.status(500).json({ message: 'Failed to log impact', error: error.message });
  }
});

router.get('/event/:event_id/status', verifyVolunteerToken, async (req, res) => {
  try {
    const statusResult = await query(
      `
        SELECT r.id, r.status, u.first_name || ' ' || COALESCE(u.last_name, '') AS volunteer_name, r.entry_time, r.exit_time, r.duration_mins
        FROM event_registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = $1
        ORDER BY r.entry_time DESC NULLS LAST
      `,
      [req.params.event_id]
    );
    const rows = statusResult.rows;
    const summary = {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'PENDING').length,
      active: rows.filter((r) => r.status === 'ACTIVE').length,
      done: rows.filter((r) => r.status === 'DONE').length,
      absent: rows.filter((r) => r.status === 'ABSENT').length,
    };

    return res.status(200).json({ summary, registrations: rows });
  } catch (error) {
    console.error("GET /event/status Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;
