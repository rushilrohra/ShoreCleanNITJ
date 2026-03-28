const express = require('express');

const { query } = require('../config/db');
const { verifyVolunteerToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', verifyVolunteerToken, async (req, res) => {
  try {
    // STEP 1 - Validate input
    const { qr_token, scan_type, event_id: selected_event_id } = req.body;
    const normalizedToken = typeof qr_token === 'string' ? qr_token.trim() : '';

    if (!normalizedToken || !scan_type) {
      return res.status(400).json({ message: 'qr_token and scan_type are required' });
    }

    if (scan_type !== 'checkin' && scan_type !== 'checkout') {
      return res.status(400).json({ message: 'scan_type must be checkin or checkout' });
    }

    // STEP 2 - Database lookup by qr_token
    const registrationResult = await query(
      `
        SELECT r.*, u.name as volunteer_name, e.title as event_title, e.event_date
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
      if (registration.status !== 'PENDING') {
        if (registration.status === 'ACTIVE') {
          // Recovery path for old/inconsistent rows: ACTIVE without entry_time.
          if (!registration.entry_time) {
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

          return res.status(409).json({ message: 'Already checked in' });
        }

        if (registration.status === 'DONE') {
          return res.status(409).json({ message: 'Already completed' });
        }

        return res.status(409).json({ message: 'Invalid registration state' });
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

      await query(
        `
          INSERT INTO scan_logs (registration_id, scanned_by, scan_type)
          VALUES ($1, $2, 'checkin')
        `,
        [registration.id, req.user.userId]
      );

      return res.status(200).json({
        success: true,
        event_id: registration.event_id,
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
        RETURNING exit_time, duration_mins
      `,
      [registration.id, durationMins]
    );

    await query(
      `
        INSERT INTO scan_logs (registration_id, scanned_by, scan_type)
        VALUES ($1, $2, 'checkout')
      `,
      [registration.id, req.user.userId]
    );

    return res.status(200).json({
      success: true,
      event_id: registration.event_id,
      event_title: registration.event_title,
      volunteer_name: registration.volunteer_name,
      message: selectedEventMismatch
        ? '✓ Check-out successful (scanner auto-switched to QR event)'
        : '✓ Check-out successful',
      duration_mins: checkoutUpdate.rows[0].duration_mins,
      exit_time: checkoutUpdate.rows[0].exit_time,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/event/:event_id/status', verifyVolunteerToken, async (req, res) => {
  try {
    const statusResult = await query(
      `
        SELECT r.id, r.status, u.name AS volunteer_name, r.entry_time, r.exit_time, r.duration_mins
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
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
