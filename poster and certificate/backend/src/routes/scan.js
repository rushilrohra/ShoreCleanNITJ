/**
 * scan.js — QR Check-in / Check-out route
 *
 * Adapted from ShoreCleanNITJ teammate's code.
 * POST /api/scan     — process a QR scan (checkin or checkout)
 *                      On checkout: triggers certificate generation + email
 * GET  /api/scan/event/:event_id/status — live status of all registrations
 *
 * No auth required in demo mode.
 */

const express = require('express');
const { query } = require('../config/db-query');
const { generateAndEmailCertificate } = require('../services/certificateService');

const router = express.Router();

router.post('/', async (req, res) => {
    try {
        // STEP 1 — Validate input
        const { qr_token, scan_type, event_id: selected_event_id } = req.body;
        const normalizedToken = typeof qr_token === 'string' ? qr_token.trim() : '';

        if (!normalizedToken || !scan_type) {
            return res.status(400).json({ message: 'qr_token and scan_type are required' });
        }

        if (scan_type !== 'checkin' && scan_type !== 'checkout') {
            return res.status(400).json({ message: 'scan_type must be checkin or checkout' });
        }

        // STEP 2 — Database lookup by qr_token
        const registrationResult = await query(
            `SELECT r.*, u.first_name || ' ' || COALESCE(u.last_name, '') AS volunteer_name,
                    u.email AS volunteer_email, u.id AS uid,
                    e.title AS event_title, e.event_date,
                    COALESCE(e.location_name, e.location, 'Unknown') AS location_name
             FROM event_registrations r
             JOIN users u ON r.user_id = u.id
             JOIN events e ON r.event_id = e.id
             WHERE r.qr_token = $1`,
            [normalizedToken]
        );

        if (registrationResult.rows.length === 0) {
            return res.status(404).json({ message: 'Registration not found for this QR code' });
        }

        const registration = registrationResult.rows[0];

        const selectedEventMismatch =
            Boolean(selected_event_id) && registration.event_id !== selected_event_id;

        // STEP 3 — Check-in state machine
        if (scan_type === 'checkin') {
            if (registration.status !== 'PENDING') {
                if (registration.status === 'ACTIVE') {
                    if (!registration.entry_time) {
                        // Recovery path
                        const repaired = await query(
                            `UPDATE event_registrations SET entry_time = NOW()
                             WHERE id = $1 RETURNING entry_time`,
                            [registration.id]
                        );
                        return res.status(200).json({
                            success: true,
                            volunteer_name: registration.volunteer_name,
                            message: '✓ Check-in recorded',
                            entry_time: repaired.rows[0].entry_time,
                        });
                    }
                    return res.status(409).json({ message: 'Already checked in' });
                }
                if (registration.status === 'DONE') {
                    return res.status(409).json({ message: 'Already completed (checked out)' });
                }
                return res.status(409).json({ message: 'Invalid registration state' });
            }

            const updateResult = await query(
                `UPDATE event_registrations SET status = 'ACTIVE', entry_time = NOW()
                 WHERE id = $1 RETURNING entry_time`,
                [registration.id]
            );

            return res.status(200).json({
                success: true,
                event_id: registration.event_id,
                event_title: registration.event_title,
                volunteer_name: registration.volunteer_name,
                message: selectedEventMismatch
                    ? '✓ Check-in successful (auto-switched to QR event)'
                    : '✓ Check-in successful',
                entry_time: updateResult.rows[0].entry_time,
            });
        }

        // STEP 4 — Check-out state machine
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
            `SELECT ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(entry_time, NOW()))) / 60)::INT AS duration_mins
             FROM event_registrations WHERE id = $1`,
            [registration.id]
        );

        const durationMins = durationResult.rows[0].duration_mins;

        const checkoutUpdate = await query(
            `UPDATE event_registrations
             SET status = 'DONE', exit_time = NOW(), duration_mins = $2
             WHERE id = $1 RETURNING exit_time, duration_mins`,
            [registration.id, durationMins]
        );

        // ── CERTIFICATE PIPELINE ──────────────────────────────────────────────
        // Run in background so response is instant
        setImmediate(async () => {
            try {
                const hours = durationMins / 60;
                await generateAndEmailCertificate({
                    volunteerId:   registration.uid,
                    volunteerName: registration.volunteer_name.trim(),
                    volunteerEmail: registration.volunteer_email,
                    eventId:       registration.event_id,
                    eventTitle:    registration.event_title,
                    locationName:  registration.location_name,
                    eventDate:     registration.event_date,
                    hours:         parseFloat(hours.toFixed(2)),
                    wasteKg:       0, // waste logs are additive; 0 default is OK
                });
                console.log(`✅ Certificate generated for ${registration.volunteer_name}`);
            } catch (certErr) {
                console.error('⚠️ Certificate generation failed (non-blocking):', certErr.message);
            }
        });

        return res.status(200).json({
            success: true,
            event_id: registration.event_id,
            event_title: registration.event_title,
            volunteer_name: registration.volunteer_name,
            message: selectedEventMismatch
                ? '✓ Check-out successful (auto-switched to QR event)'
                : '✓ Check-out successful — certificate will be emailed shortly!',
            duration_mins: checkoutUpdate.rows[0].duration_mins,
            exit_time: checkoutUpdate.rows[0].exit_time,
        });

    } catch (error) {
        console.error('Scan error:', error.message);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// GET live status of all registrations for an event
router.get('/event/:event_id/status', async (req, res) => {
    try {
        const statusResult = await query(
            `SELECT r.id, r.status,
                    u.first_name || ' ' || COALESCE(u.last_name, '') AS volunteer_name,
                    r.entry_time, r.exit_time, r.duration_mins
             FROM event_registrations r
             JOIN users u ON r.user_id = u.id
             WHERE r.event_id = $1
             ORDER BY r.entry_time DESC NULLS LAST`,
            [req.params.event_id]
        );

        const rows = statusResult.rows;
        const summary = {
            total:   rows.length,
            pending: rows.filter((r) => r.status === 'PENDING').length,
            active:  rows.filter((r) => r.status === 'ACTIVE').length,
            done:    rows.filter((r) => r.status === 'DONE').length,
            absent:  rows.filter((r) => r.status === 'ABSENT').length,
        };

        return res.status(200).json({ summary, registrations: rows });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
