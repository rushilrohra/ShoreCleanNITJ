const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');

// ─── GET volunteer dashboard (demo: returns first volunteer's data or aggregate) ──
router.get('/volunteer', async (req, res) => {
    try {
        // In demo mode: show the first volunteer's badges, or aggregate stats
        const firstUserResult = await pool.query(
            `SELECT id FROM users WHERE role = 'volunteer' ORDER BY id ASC LIMIT 1`
        );

        let badges = null;
        let certificates = [];
        let events = [];

        if (firstUserResult.rows.length > 0) {
            const volunteerId = firstUserResult.rows[0].id;

            const badgesResult = await pool.query(
                'SELECT * FROM volunteer_badges WHERE volunteer_id = $1',
                [volunteerId]
            );
            badges = badgesResult.rows[0] || null;

            const certificatesResult = await pool.query(
                `SELECT c.*, e.title AS event_title, e.location_name, e.event_date
                 FROM certificates c
                 LEFT JOIN events e ON c.event_id = e.id
                 ORDER BY c.issue_date DESC`,
            );
            certificates = certificatesResult.rows;

            const eventsResult = await pool.query(
                `SELECT e.*, ea.status, ea.check_in_time, ea.check_out_time
                 FROM events e
                 LEFT JOIN event_attendance ea ON e.id = ea.event_id AND ea.volunteer_id = $1
                 ORDER BY e.event_date DESC`,
                [volunteerId]
            );
            events = eventsResult.rows;
        } else {
            // No volunteers yet — return all certificates
            const certsResult = await pool.query(
                `SELECT c.*, e.title AS event_title, e.location_name, e.event_date
                 FROM certificates c
                 LEFT JOIN events e ON c.event_id = e.id
                 ORDER BY c.issue_date DESC`
            );
            certificates = certsResult.rows;
        }

        const rankResult = await pool.query(
            `SELECT * FROM leaderboard ORDER BY rank ASC LIMIT 1`
        );

        res.json({
            badges,
            certificates,
            events,
            rank: rankResult.rows[0]?.rank || null,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GET leaderboard (public) ─────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT l.*, u.first_name, u.last_name, u.profile_picture_url
             FROM leaderboard l
             JOIN users u ON l.volunteer_id = u.id
             ORDER BY l.rank ASC
             LIMIT 100`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
