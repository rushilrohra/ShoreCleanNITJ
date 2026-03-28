const express = require('express');
const { customAlphabet } = require('nanoid');
const { v4: uuidv4 } = require('uuid');

const { query } = require('../config/db');
const { verifyUserToken } = require('../middleware/auth');

const router = express.Router();
const generateQrToken = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 20);

const createUniqueQrToken = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const token = generateQrToken();
    const existing = await query('SELECT 1 FROM event_registrations WHERE qr_token = $1 LIMIT 1', [token]);
    if (existing.rows.length === 0) {
      return token;
    }
  }

  throw new Error('Could not generate unique QR token');
};

router.post('/', verifyUserToken, async (req, res) => {
  try {
    const { event_id } = req.body;

    if (!event_id) {
      return res.status(400).json({ message: 'event_id is required' });
    }

    const eventResult = await query(
      `
        SELECT
          e.id,
          e.event_date,
          100 AS max_volunteers,
          COUNT(r.id) AS registered_count
        FROM events e
        LEFT JOIN event_registrations r ON e.id = r.event_id
        WHERE e.id = $1
        GROUP BY e.id
      `,
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const event = eventResult.rows[0];

    const hasPassedResult = await query('SELECT $1::date < CURRENT_DATE AS has_passed', [event.event_date]);
    if (hasPassedResult.rows[0].has_passed) {
      return res.status(400).json({ message: 'Cannot register for a past event' });
    }

    const existingRegistration = await query(
      'SELECT id FROM event_registrations WHERE user_id = $1 AND event_id = $2 LIMIT 1',
      [req.user.userId, event_id]
    );

    if (existingRegistration.rows.length > 0) {
      return res.status(409).json({ message: 'Already registered for this event' });
    }

    const registeredCount = Number(event.registered_count);
    if (event.max_volunteers !== null && registeredCount >= Number(event.max_volunteers)) {
      return res.status(400).json({ message: 'Event is full' });
    }

    // In the main DB schemas event_registrations uses SERIAL 'id' instead of UUID. 
    // We omit ID entirely to let SERIAL handle it!
    const qrToken = await createUniqueQrToken();

    const createdRegistration = await query(
      `
        INSERT INTO event_registrations (user_id, event_id, qr_token, status)
        VALUES ($1, $2, $3, 'PENDING')
        RETURNING id, event_id, qr_token, status
      `,
      [req.user.userId, event_id, qrToken]
    );

    return res.status(201).json({
      message: 'Registered successfully',
      registration: createdRegistration.rows[0],
    });
  } catch (error) {
    console.error("POST /reg Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/my', verifyUserToken, async (req, res) => {
  try {
    const registrations = await query(
      `
        SELECT r.*, e.title, e.location_name AS beach_name, e.event_date, e.start_time, e.location_name AS location
        FROM event_registrations r
        JOIN events e ON r.event_id = e.id
        WHERE r.user_id = $1
        ORDER BY e.event_date DESC
      `,
      [req.user.userId]
    );

    return res.status(200).json(registrations.rows);
  } catch (error) {
    console.error("GET /my Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

module.exports = router;
