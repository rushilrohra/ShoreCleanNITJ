const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { isWithinGeofence, hasTimePassed } = require('../utils/geofencing');
const { generateCertificate, determineBadgeTier } = require('../services/certificateService');
const { sendCertificateEmail } = require('../services/emailService');

// Check-in volunteer
router.post('/checkin', authMiddleware, async (req, res) => {
    try {
        const { eventId, latitude, longitude } = req.body;
        const volunteerId = req.user.id;

        // Get event details
        const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        if (eventResult.rows.length === 0) {
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = eventResult.rows[0];

        // Verify geofence
        if (!isWithinGeofence(latitude, longitude, event.latitude, event.longitude, 500)) {
            return res.status(403).json({ error: 'Location not within event geofence' });
        }

        // Record check-in
        const result = await pool.query(
            `INSERT INTO event_attendance (volunteer_id, event_id, check_in_time, check_in_latitude, check_in_longitude, status)
       VALUES ($1, $2, NOW(), $3, $4, 'checked_in')
       ON CONFLICT (volunteer_id, event_id) DO UPDATE SET check_in_time = NOW()
       RETURNING *`,
            [volunteerId, eventId, latitude, longitude]
        );

        res.json({ message: 'Check-in successful', attendance: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Check-out volunteer
router.post('/checkout', authMiddleware, async (req, res) => {
    try {
        const { eventId, latitude, longitude } = req.body;
        const volunteerId = req.user.id;

        // Get attendance record
        const attendanceResult = await pool.query(
            'SELECT * FROM event_attendance WHERE volunteer_id = $1 AND event_id = $2',
            [volunteerId, eventId]
        );

        if (attendanceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Check-in not found' });
        }

        const attendance = attendanceResult.rows[0];

        // Verify geofence
        const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        const event = eventResult.rows[0];

        if (!isWithinGeofence(latitude, longitude, event.latitude, event.longitude, 500)) {
            // Log fraud flag
            await pool.query(
                `INSERT INTO fraud_flags (volunteer_id, event_id, flag_type, description, severity)
         VALUES ($1, $2, 'gps_mismatch', 'Check-out location outside geofence', 'high')`,
                [volunteerId, eventId]
            );
            return res.status(403).json({ error: 'Check-out location not within geofence' });
        }

        // Verify minimum time has passed
        if (!hasTimePassed(attendance.check_in_time, 120)) {
            return res.status(403).json({ error: 'Minimum 2-hour duration required' });
        }

        // Calculate duration
        const duration = Math.floor((Date.now() - new Date(attendance.check_in_time).getTime()) / 60000);

        // Update attendance
        const result = await pool.query(
            `UPDATE event_attendance 
       SET check_out_time = NOW(), check_out_latitude = $1, check_out_longitude = $2, total_duration_minutes = $3, status = 'checked_out'
       WHERE volunteer_id = $4 AND event_id = $5
       RETURNING *`,
            [latitude, longitude, duration, volunteerId, eventId]
        );

        // Generate and send certificate
        try {
            const hours = duration / 60; // Convert minutes to hours

            // Get volunteer and waste data
            const volunteerResult = await pool.query('SELECT * FROM users WHERE id = $1', [volunteerId]);
            const volunteer = volunteerResult.rows[0];

            const wasteResult = await pool.query(
                'SELECT SUM(estimated_weight_kg) as total_waste FROM waste_logs WHERE volunteer_id = $1 AND event_id = $2',
                [volunteerId, eventId]
            );
            const wasteKg = wasteResult.rows[0].total_waste || 0;

            // Generate certificate
            const certData = await generateCertificate(
                volunteer.first_name + ' ' + volunteer.last_name,
                hours,
                wasteKg,
                new Date(),
                null,
                event.location_name
            );

            // Get badge tier
            const badgeTier = await determineBadgeTier(hours, wasteKg);

            // Save certificate to database
            const certResult = await pool.query(
                `INSERT INTO certificates (volunteer_id, event_id, certificate_url, badge_tier, total_hours, total_waste_kg, verification_hash)
         VALUES ($1, $2, $3, $4, $5, $6, uuid_generate_v4())
         RETURNING *`,
                [volunteerId, eventId, certData.url, badgeTier, hours, wasteKg]
            );

            // Update volunteer badges
            if (badgeTier) {
                const badgeColumn = `${badgeTier.toLowerCase()}_count`;
                await pool.query(
                    `UPDATE volunteer_badges 
             SET ${badgeColumn} = ${badgeColumn} + 1,
                 total_impact_hours = total_impact_hours + $1,
                 total_waste_collected_kg = total_waste_collected_kg + $2,
                 total_events_attended = total_events_attended + 1,
                 impact_score = (total_impact_hours + $1) * 10 + (total_waste_collected_kg + $2) * 5
             WHERE volunteer_id = $3`,
                    [hours, wasteKg, volunteerId]
                );
            }

            // Update leaderboard
            await pool.query(
                `INSERT INTO leaderboard (volunteer_id, rank, impact_score, total_hours, total_waste_kg, badge_points)
         SELECT volunteer_id, ROW_NUMBER() OVER (ORDER BY impact_score DESC), impact_score, total_impact_hours, total_waste_collected_kg, 
                (bronze_count * 20 + silver_count * 50 + gold_count * 100)
         FROM volunteer_badges
         WHERE volunteer_id = $1
         ON CONFLICT (volunteer_id) DO UPDATE SET 
            impact_score = EXCLUDED.impact_score,
            total_hours = EXCLUDED.total_hours,
            total_waste_kg = EXCLUDED.total_waste_kg,
            badge_points = EXCLUDED.badge_points`,
                [volunteerId]
            );

            // Send certificate email (Cloudinary URL is already absolute)
            const volunteerName = `${volunteer.first_name} ${volunteer.last_name}`;
            await sendCertificateEmail(
                volunteer.email,
                volunteerName,
                certData.url,
                badgeTier || 'Bronze',
                hours,
                wasteKg
            );

            res.json({
                message: 'Check-out successful! Certificate generated and sent to email.',
                attendance: result.rows[0],
                certificate: certResult.rows[0]
            });
        } catch (certError) {
            console.error('Error generating certificate:', certError);
            res.json({
                message: 'Check-out successful! Certificate generation pending.',
                attendance: result.rows[0],
                warning: 'Certificate could not be generated automatically. Please check your email or dashboard.'
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
