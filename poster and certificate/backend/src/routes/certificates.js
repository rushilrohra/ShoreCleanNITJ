const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { generateCertificate } = require('../services/certificateService');

// Get certificates (demo: returns all certificates)
router.get('/my-certificates', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, e.title AS event_title, e.location_name, e.event_date
             FROM certificates c
             LEFT JOIN events e ON c.event_id = e.id
             ORDER BY c.issue_date DESC`
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify certificate (public endpoint - no auth needed)
router.get('/verify/:hash', async (req, res) => {
    try {
        const { hash } = req.params;
        const result = await pool.query(
            `SELECT c.*, u.first_name, u.last_name, e.title, e.location_name, e.event_date
       FROM certificates c
       JOIN users u ON c.volunteer_id = u.id
       JOIN events e ON c.event_id = e.id
       WHERE c.verification_hash = $1`,
            [hash]
        );

        if (result.rows.length === 0) {
            return res.json({ verified: false });
        }

        res.json({ verified: true, certificate: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate certificate (called after check-out)
router.post('/generate', authMiddleware, async (req, res) => {
    try {
        const { eventId } = req.body;
        const volunteerId = req.user.id;

        // Get attendance record
        const attendanceResult = await pool.query(
            `SELECT ea.*, e.title as event_title, e.location_name, e.event_date, u.first_name, u.last_name
       FROM event_attendance ea
       JOIN events e ON ea.event_id = e.id
       JOIN users u ON u.id = ea.volunteer_id
       WHERE ea.volunteer_id = $1 AND ea.event_id = $2 AND ea.status = 'checked_out'`,
            [volunteerId, eventId]
        );

        if (attendanceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Attendance record not found or not checked out' });
        }

        const attendance = attendanceResult.rows[0];

        // Count waste logs
        const wasteResult = await pool.query(
            `SELECT COUNT(*) as count, SUM(estimated_weight_kg) as total_weight
       FROM waste_logs
       WHERE volunteer_id = $1 AND event_id = $2`,
            [volunteerId, eventId]
        );

        const wasteCount = parseInt(wasteResult.rows[0].count);
        const totalWasteKg = wasteResult.rows[0].total_weight || 0;

        if (wasteCount < 1) {
            return res.status(400).json({ error: 'At least one waste photo required for certificate' });
        }

        const hours = attendance.total_duration_minutes / 60;
        const volunteerName = `${attendance.first_name} ${attendance.last_name}`;

        // Generate certificate
        const { url, tier } = await generateCertificate(
            volunteerName,
            parseFloat(hours.toFixed(2)),
            parseFloat(totalWasteKg.toFixed(2)),
            attendance.event_date,
            `cert-${volunteerId}-${eventId}`,
            attendance.location_name
        );

        // Insert certificate record
        const certResult = await pool.query(
            `INSERT INTO certificates (volunteer_id, event_id, certificate_url, badge_tier, total_hours, total_waste_kg, verification_hash)
       VALUES ($1, $2, $3, $4, $5, $6, uuid_generate_v4())
       RETURNING *`,
            [volunteerId, eventId, url, tier, hours, totalWasteKg]
        );

        // Update volunteer badges
        await pool.query(
            `INSERT INTO volunteer_badges (volunteer_id, bronze_count, silver_count, gold_count, total_impact_hours, total_waste_collected_kg, total_events_attended)
       VALUES ($1, CASE WHEN $2 = 'Bronze' THEN 1 ELSE 0 END, CASE WHEN $2 = 'Silver' THEN 1 ELSE 0 END, CASE WHEN $2 = 'Gold' THEN 1 ELSE 0 END, $3, $4, 1)
       ON CONFLICT (volunteer_id) DO UPDATE SET
         bronze_count = volunteer_badges.bronze_count + CASE WHEN $2 = 'Bronze' THEN 1 ELSE 0 END,
         silver_count = volunteer_badges.silver_count + CASE WHEN $2 = 'Silver' THEN 1 ELSE 0 END,
         gold_count = volunteer_badges.gold_count + CASE WHEN $2 = 'Gold' THEN 1 ELSE 0 END,
         total_impact_hours = volunteer_badges.total_impact_hours + $3,
         total_waste_collected_kg = volunteer_badges.total_waste_collected_kg + $4,
         total_events_attended = volunteer_badges.total_events_attended + 1`,
            [volunteerId, tier, hours, totalWasteKg]
        );

        res.status(201).json({ certificate: certResult.rows[0], tier });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
