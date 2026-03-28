/**
 * registrations.js — Volunteer self-registration for events
 *
 * Adapted from ShoreCleanNITJ teammate's code.
 * POST /api/registrations      — register for an event (gets QR token)
 * GET  /api/registrations/my   — get your registrations
 * GET  /api/registrations/:id/qr — get QR code image as data URL
 *
 * No auth required in demo mode — pass volunteer_id in body.
 */

const express = require('express');
const { query } = require('../config/db-query');
const QRCode   = require('qrcode');

const router = express.Router();

// Generate a short unique alphanumeric QR token
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
function generateToken(len = 20) {
    let s = '';
    for (let i = 0; i < len; i++) {
        s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return s;
}

async function createUniqueQrToken() {
    for (let i = 0; i < 5; i++) {
        const token = generateToken();
        const existing = await query(
            'SELECT 1 FROM event_registrations WHERE qr_token = $1 LIMIT 1', [token]
        );
        if (existing.rows.length === 0) return token;
    }
    throw new Error('Could not generate unique QR token');
}

// ─── POST: Register for an event ──────────────────────────────────────────────
// Body: { event_id, volunteer_id (demo) }
router.post('/', async (req, res) => {
    try {
        const { event_id, volunteer_id } = req.body;

        if (!event_id || !volunteer_id) {
            return res.status(400).json({ message: 'event_id and volunteer_id are required' });
        }

        // Check event exists and is not full
        const eventResult = await query(
            `SELECT e.id, e.event_date, e.max_volunteers,
                    COUNT(r.id) AS registered_count
             FROM events e
             LEFT JOIN event_registrations r ON e.id = r.event_id
             WHERE e.id = $1
             GROUP BY e.id`,
            [event_id]
        );

        if (eventResult.rows.length === 0) {
            return res.status(404).json({ message: 'Event not found' });
        }

        const event = eventResult.rows[0];

        // Already registered?
        const existingReg = await query(
            'SELECT id, qr_token FROM event_registrations WHERE user_id = $1 AND event_id = $2 LIMIT 1',
            [volunteer_id, event_id]
        );

        if (existingReg.rows.length > 0) {
            // Return existing registration + QR image
            const qrDataUrl = await QRCode.toDataURL(existingReg.rows[0].qr_token, { width: 300 });
            return res.status(200).json({
                message: 'Already registered',
                registration: existingReg.rows[0],
                qr_image: qrDataUrl,
            });
        }

        // Check capacity
        if (
            event.max_volunteers !== null &&
            Number(event.registered_count) >= Number(event.max_volunteers)
        ) {
            return res.status(400).json({ message: 'Event is full' });
        }

        // Create registration
        const qrToken = await createUniqueQrToken();
        const qrDataUrl = await QRCode.toDataURL(qrToken, { width: 300 });

        const reg = await query(
            `INSERT INTO event_registrations (user_id, event_id, qr_token, status)
             VALUES ($1, $2, $3, 'PENDING')
             RETURNING id, event_id, qr_token, status, registered_at`,
            [volunteer_id, event_id, qrToken]
        );

        return res.status(201).json({
            message: '✅ Registered successfully! Your QR code is ready.',
            registration: reg.rows[0],
            qr_image: qrDataUrl,
        });
    } catch (error) {
        console.error('Registration error:', error.message);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── GET: My Registrations ────────────────────────────────────────────────────
router.get('/my', async (req, res) => {
    try {
        const { volunteer_id } = req.query;
        if (!volunteer_id) {
            // Return all registrations for demo
            const all = await query(
                `SELECT r.*, e.title, e.location_name, e.event_date,
                        u.first_name || ' ' || COALESCE(u.last_name, '') AS volunteer_name
                 FROM event_registrations r
                 JOIN events e ON r.event_id = e.id
                 JOIN users u ON r.user_id = u.id
                 ORDER BY e.event_date DESC`
            );
            return res.json(all.rows);
        }

        const result = await query(
            `SELECT r.*, e.title, e.location_name, e.event_date
             FROM event_registrations r
             JOIN events e ON r.event_id = e.id
             WHERE r.user_id = $1
             ORDER BY e.event_date DESC`,
            [volunteer_id]
        );
        return res.json(result.rows);
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// ─── GET: Registration QR Code image ─────────────────────────────────────────
router.get('/:id/qr', async (req, res) => {
    try {
        const regResult = await query(
            'SELECT qr_token FROM event_registrations WHERE id = $1',
            [req.params.id]
        );
        if (regResult.rows.length === 0) {
            return res.status(404).json({ message: 'Registration not found' });
        }

        const qrDataUrl = await QRCode.toDataURL(regResult.rows[0].qr_token, { width: 300 });
        return res.json({ qr_image: qrDataUrl, qr_token: regResult.rows[0].qr_token });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
