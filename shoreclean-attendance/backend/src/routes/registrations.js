const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');

const { query } = require('../config/db');
const { verifyUserToken } = require('../middleware/auth');
const { upload, cloudinary } = require('../config/cloudinary');

const router = express.Router();

router.post('/', verifyUserToken, upload.single('photo'), async (req, res) => {
  try {
    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ error: 'event_id is required' });
    }

    const eventResult = await query(
      `
        SELECT
          e.id,
          e.event_date,
          e.max_volunteers,
          COUNT(r.id) AS registered_count
        FROM events e
        LEFT JOIN event_registrations r ON e.id = r.event_id
        WHERE e.id = $1
        GROUP BY e.id
      `,
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.rows[0];

    const hasPassedResult = await query('SELECT $1::date < CURRENT_DATE AS has_passed', [event.event_date]);
    if (hasPassedResult.rows[0].has_passed) {
      return res.status(400).json({ error: 'Cannot register for a past event' });
    }

    const existingRegistration = await query(
      'SELECT id FROM event_registrations WHERE user_id = $1 AND event_id = $2 LIMIT 1',
      [req.user.userId, event_id]
    );

    if (existingRegistration.rows.length > 0) {
      return res.status(409).json({ error: 'Already registered for this event' });
    }

    const registeredCount = Number(event.registered_count);
    if (event.max_volunteers !== null && registeredCount >= Number(event.max_volunteers)) {
      return res.status(400).json({ error: 'Event is full' });
    }

    // Photo is required
    if (!req.file) {
      return res.status(400).json({ error: 'Photo is required for registration.' });
    }

    const photo_url = req.file.path; // Cloudinary URL

    // Generate QR token (same as before)
    const qrToken = jwt.sign(
      { reg_id: uuid(), user_id: req.user.userId, event_id },
      process.env.QR_SECRET,
      { expiresIn: '8d' }
    );

    // Insert with photo_url
    const result = await query(
      `INSERT INTO event_registrations
       (user_id, event_id, qr_token, status, photo_url)
       VALUES ($1, $2, $3, 'PENDING', $4) RETURNING *`,
      [req.user.userId, event_id, qrToken, photo_url]
    );

    return res.status(201).json({
      message: 'Registered successfully',
      registration: result.rows[0],
    });
  } catch (err) {
    // If upload succeeded but DB failed, delete the uploaded photo
    if (req.file?.filename) {
      await cloudinary.uploader.destroy(req.file.filename).catch(() => {});
    }
    console.error(err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

router.get('/my', verifyUserToken, async (req, res) => {
  try {
    const registrations = await query(
      `
        SELECT r.*, r.photo_url, e.title, e.beach_name, e.event_date, e.start_time, e.location
        FROM event_registrations r JOIN events e ON r.event_id = e.id
        WHERE r.user_id = $1 ORDER BY e.event_date DESC
      `,
      [req.user.userId]
    );

    return res.status(200).json(registrations.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:id/cancel', verifyUserToken, async (req, res) => {
  try {
    // Fetch the registration
    const result = await query(
      `SELECT * FROM event_registrations WHERE id = $1`,
      [req.params.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const reg = result.rows[0];

    // Ownership check
    if (reg.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Not your registration' });
    }

    // Can only cancel PENDING registrations
    if (reg.status !== 'PENDING') {
      return res.status(400).json({
        error: reg.status === 'ACTIVE'
          ? 'You are already checked in. Ask the organizer to check you out first.'
          : reg.status === 'CANCELLED'
            ? 'Already cancelled'
            : 'Cannot cancel a completed registration',
      });
    }

    // Soft delete - update status to CANCELLED
    await query(
      `UPDATE event_registrations SET status = 'CANCELLED' WHERE id = $1`,
      [req.params.id]
    );

    return res.status(200).json({ message: 'Registration cancelled successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Cancellation failed' });
  }
});

router.get('/:registrationId/pass', verifyUserToken, async (req, res) => {
  try {
    const { registrationId } = req.params;

    const result = await query(
      `
        SELECT
          r.id,
          r.user_id,
          r.event_id,
          r.qr_token,
          r.status,
          r.entry_time,
          r.exit_time,
          r.duration_mins,
          r.registered_at,
          r.photo_url,
          e.title,
          e.beach_name,
          e.location,
          e.latitude,
          e.longitude,
          e.event_date,
          e.start_time,
          e.end_time,
          u.name AS user_name,
          u.email AS user_email,
          u.phone AS user_phone
        FROM event_registrations r
        JOIN events e ON e.id = r.event_id
        JOIN users u ON u.id = r.user_id
        WHERE r.id = $1 AND r.user_id = $2
        LIMIT 1
      `,
      [registrationId, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const row = result.rows[0];

    return res.status(200).json({
      registration: {
        id: row.id,
        event_id: row.event_id,
        qr_token: row.qr_token,
        status: row.status,
        entry_time: row.entry_time,
        exit_time: row.exit_time,
        duration_mins: row.duration_mins,
        registered_at: row.registered_at,
        photo_url: row.photo_url,
        title: row.title,
        beach_name: row.beach_name,
        location: row.location,
        latitude: row.latitude,
        longitude: row.longitude,
        event_date: row.event_date,
        start_time: row.start_time,
        end_time: row.end_time,
      },
      user: {
        id: row.user_id,
        name: row.user_name,
        email: row.user_email,
        phone: row.user_phone,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch pass data' });
  }
});

module.exports = router;
