const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const QRCode  = require('qrcode');

// ─── GET all events ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT e.*, u.first_name AS organizer_name
             FROM events e
             LEFT JOIN users u ON e.organizer_id = u.id
             ORDER BY e.event_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── POST create event (no auth for demo) ─────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const {
            title, description, locationName,
            latitude = 0, longitude = 0,
            eventDate, expectedVolunteers = 50,
        } = req.body;

        if (!title || !locationName || !eventDate) {
            return res.status(400).json({ error: 'title, locationName and eventDate are required' });
        }

        // Generate QR codes
        const checkInQr  = await QRCode.toDataURL(`checkin-${Date.now()}`);
        const checkOutQr = await QRCode.toDataURL(`checkout-${Date.now()}`);

        const result = await pool.query(
            `INSERT INTO events
               (organizer_id, title, description, location_name, latitude, longitude,
                event_date, check_in_qr_code, check_out_qr_code, expected_volunteers)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [
                null,             // no organizer required in demo mode
                title, description, locationName,
                latitude, longitude,
                eventDate, checkInQr, checkOutQr,
                expectedVolunteers,
            ]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GET my-events — returns all events (no user filter in demo) ───────────────
router.get('/my-events', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM events ORDER BY event_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GET single event ─────────────────────────────────────────────────────────
router.get('/:eventId', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM events WHERE id = $1',
            [req.params.eventId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
