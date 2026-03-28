/**
 * ShoreClean Admin Routes
 *
 * POST /api/admin/generate-poster    — AI poster generation + email to admin
 * POST /api/admin/send-announcement  — Send event invite to all volunteers
 * GET  /api/admin/fraud-flags        — Fraud flag monitoring
 * GET  /api/admin/event-stats/:id    — Event statistics
 * GET  /api/admin/certificate-stats  — Certificate overview
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { generatePosterContent, generateSocialCaptions } = require('../services/aiService');
const { generatePoster } = require('../services/posterService');
const { sendPosterEmail, sendEventAnnouncementEmail } = require('../services/emailService');

// ─── GET: Fraud Flags ──────────────────────────────────────────────────────────
router.get('/fraud-flags', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ff.*, u.first_name, u.last_name, u.email, e.title AS event_title
             FROM fraud_flags ff
             LEFT JOIN users u ON ff.volunteer_id = u.id
             LEFT JOIN events e ON ff.event_id = e.id
             ORDER BY ff.created_at DESC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GET: Event Statistics ─────────────────────────────────────────────────────
router.get('/event-stats/:eventId', authMiddleware, async (req, res) => {
    try {
        const { eventId } = req.params;

        const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const attendanceResult = await pool.query(
            `SELECT COUNT(*) AS total_volunteers,
                    COUNT(CASE WHEN status = 'checked_out' THEN 1 END) AS completed,
                    COUNT(CASE WHEN status = 'checked_in'  THEN 1 END) AS in_progress
             FROM event_attendance WHERE event_id = $1`,
            [eventId]
        );

        const wasteResult = await pool.query(
            `SELECT COUNT(*) AS total_photos, SUM(estimated_weight_kg) AS total_waste_kg
             FROM waste_logs WHERE event_id = $1`,
            [eventId]
        );

        const certResult = await pool.query(
            `SELECT COUNT(*) AS total_certificates FROM certificates WHERE event_id = $1`,
            [eventId]
        );

        res.json({
            event:       eventResult.rows[0],
            attendance:  attendanceResult.rows[0],
            waste:       wasteResult.rows[0],
            certificates: certResult.rows[0],
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GET: Certificate Stats ────────────────────────────────────────────────────
router.get('/certificate-stats', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT
               COUNT(*) AS total_certificates,
               COUNT(DISTINCT volunteer_id) AS unique_volunteers,
               SUM(CASE WHEN badge_tier = 'Bronze' THEN 1 ELSE 0 END) AS bronze_count,
               SUM(CASE WHEN badge_tier = 'Silver' THEN 1 ELSE 0 END) AS silver_count,
               SUM(CASE WHEN badge_tier = 'Gold'   THEN 1 ELSE 0 END) AS gold_count
             FROM certificates`
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── POST: Generate AI Poster ──────────────────────────────────────────────────
// No auth required — demo-friendly
router.post('/generate-poster', async (req, res) => {
    try {
        const { eventId } = req.body;
        const adminEmail = process.env.EMAIL_USER;
        const adminName  = 'Organizer';

        if (!eventId) {
            return res.status(400).json({ error: 'eventId is required' });
        }

        // ── Fetch event (support demo events for testing) ──────────────────
        let event;
        if (String(eventId).startsWith('demo-')) {
            const demoMap = {
                'demo-1': { id: 'demo-1', title: 'Juhu Beach Cleanup Drive', location_name: 'Juhu Beach, Mumbai', event_date: new Date().toISOString(), description: 'Community cleanup drive at Juhu Beach' },
                'demo-2': { id: 'demo-2', title: 'Marina Coastal Care',      location_name: 'Marina Beach, Chennai', event_date: new Date().toISOString(), description: 'Eco-volunteer mission at Marina Beach' },
            };
            event = demoMap[eventId];
            if (!event) return res.status(404).json({ error: 'Demo event not found' });
        } else {
            const eventResult = await pool.query(
                'SELECT * FROM events WHERE id = $1',
                [eventId]
            );
            if (eventResult.rows.length === 0) {
                return res.status(404).json({ error: 'Event not found' });
            }
            event = eventResult.rows[0];
        }

        const eventDetails = {
            title:       event.title,
            location:    event.location_name,
            date:        event.event_date,
            description: event.description,
            organizer:   adminName,
        };

        console.log(`🎨 Starting poster generation for event: "${event.title}"`);

        // ── Step 1: Gemini → Poster copy ──────────────────────────────────
        const posterContent = await generatePosterContent(eventDetails);

        // ── Step 2: Stability AI + Sharp → PNG → Cloudinary ───────────────
        const posterResult = await generatePoster(posterContent, eventDetails);

        // ── Step 3: Gemini → Social captions ──────────────────────────────
        const socialCaptions = await generateSocialCaptions(eventDetails);

        // ── Step 4: Email poster to admin ─────────────────────────────────
        const emailResult = await sendPosterEmail(adminEmail, posterResult.url, event.title);
        console.log(`📧 Poster email result:`, emailResult);

        res.json({
            success:        true,
            message:        emailResult.success
                              ? '✅ Poster generated and emailed successfully!'
                              : '⚠️ Poster generated but email delivery failed.',
            posterUrl:      posterResult.url,
            socialCaptions,
            emailSent:      emailResult.success,
        });
    } catch (error) {
        console.error('❌ Poster generation error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ─── POST: Send Event Announcement to All Volunteers ──────────────────────────
// No auth required — admin manually clicks this button
router.post('/send-announcement', async (req, res) => {
    try {
        const { eventId } = req.body;

        if (!eventId) {
            return res.status(400).json({ error: 'eventId is required' });
        }

        // Fetch event details
        const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const event = eventResult.rows[0];

        // Fetch all volunteer emails
        const volunteersResult = await pool.query(
            `SELECT email FROM users WHERE role = 'volunteer' AND email IS NOT NULL`
        );

        if (volunteersResult.rows.length === 0) {
            return res.status(404).json({ error: 'No registered volunteers found' });
        }

        const volunteerEmails = volunteersResult.rows.map(row => row.email);
        console.log(`📣 Sending announcement to ${volunteerEmails.length} volunteers for event: "${event.title}"`);

        // Send announcement
        const emailResult = await sendEventAnnouncementEmail(volunteerEmails, event);

        res.json({
            success:        emailResult.success,
            message:        emailResult.success
                              ? `✅ Announcement sent to ${emailResult.recipientCount} volunteers!`
                              : `❌ Failed to send announcement: ${emailResult.error}`,
            recipientCount: emailResult.recipientCount || 0,
        });
    } catch (error) {
        console.error('❌ Send announcement error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
