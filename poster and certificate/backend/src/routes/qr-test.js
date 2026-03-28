const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { generateCertificate, determineBadgeTier } = require('../services/certificateService');

// TEST ENDPOINT: Manual checkout (for development/testing only)
router.post('/test-checkout', authMiddleware, async (req, res) => {
    try {
        const { eventId, hours = 2, wasteKg = 15 } = req.body;
        const volunteerId = req.user.id;

        // Get event details
        const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }
        const event = eventResult.rows[0];

        // Get volunteer details
        const volunteerResult = await pool.query('SELECT * FROM users WHERE id = $1', [volunteerId]);
        if (volunteerResult.rows.length === 0) {
            return res.status(404).json({ error: 'Volunteer not found' });
        }
        const volunteer = volunteerResult.rows[0];
        const volunteerName = `${volunteer.first_name} ${volunteer.last_name}`;

        // Determine badge tier
        const tier = await determineBadgeTier(hours, wasteKg);

        // Generate certificate
        const { url, tier: assignedTier } = await generateCertificate(
            volunteerName,
            parseFloat(hours.toFixed(2)),
            parseFloat(wasteKg.toFixed(2)),
            event.event_date,
            `test-cert-${volunteerId}-${eventId}-${Date.now()}`,
            event.location_name
        );

        console.log('✓ Certificate generated with URL:', url);

        // Insert certificate record
        const certResult = await pool.query(
            `INSERT INTO certificates (volunteer_id, event_id, certificate_url, badge_tier, total_hours, total_waste_kg, verification_hash)
             VALUES ($1, $2, $3, $4, $5, $6, uuid_generate_v4())
             RETURNING *`,
            [volunteerId, eventId, url, assignedTier, hours, wasteKg]
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
            [volunteerId, assignedTier, hours, wasteKg]
        );

        res.status(201).json({
            success: true,
            message: '✓ Test certificate generated successfully!',
            certificate: certResult.rows[0],
            badge_tier: assignedTier,
            certificate_url: url
        });
    } catch (error) {
        console.error('Test checkout error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
