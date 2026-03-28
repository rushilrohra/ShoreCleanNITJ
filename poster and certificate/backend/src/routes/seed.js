const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// SEED ENDPOINT: Create test events (development only)
router.post('/seed-events', async (req, res) => {
    try {
        // First, ensure we have at least one organizer
        const organizerCheck = await pool.query(
            "SELECT id FROM users WHERE role = 'organizer' LIMIT 1"
        );

        let organizerId;

        if (organizerCheck.rows.length === 0) {
            // Create a test organizer if none exists
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash('organizer123', 10);

            const organizerResult = await pool.query(
                "INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING id",
                ['organizer@test.com', hashedPassword, 'Test', 'Organizer', 'organizer']
            );
            organizerId = organizerResult.rows[0].id;
        } else {
            organizerId = organizerCheck.rows[0].id;
        }

        // Create test events
        const testEvents = [
            {
                title: 'Juhu Beach Cleanup',
                description: 'Weekly beach cleanup drive',
                locationName: 'Juhu Beach, Mumbai',
                latitude: 19.1041,
                longitude: 72.8260,
                expectedVolunteers: 50
            },
            {
                title: 'Marine Drive Cleanup',
                description: 'Coastal conservation event',
                locationName: 'Marine Drive, Mumbai',
                latitude: 18.9432,
                longitude: 72.8236,
                expectedVolunteers: 75
            },
            {
                title: 'Worli Beach Cleanup',
                description: 'Community service initiative',
                locationName: 'Worli Beach, Mumbai',
                latitude: 19.0176,
                longitude: 72.8291,
                expectedVolunteers: 100
            }
        ];

        const createdEvents = [];

        for (const event of testEvents) {
            const eventDate = new Date();
            eventDate.setHours(eventDate.getHours() + 2); // Event in 2 hours

            const result = await pool.query(
                `INSERT INTO events (organizer_id, title, description, location_name, latitude, longitude, event_date, expected_volunteers, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
                 RETURNING id, title, location_name, event_date`,
                [organizerId, event.title, event.description, event.locationName, event.latitude, event.longitude, eventDate, event.expectedVolunteers]
            );

            createdEvents.push(result.rows[0]);
        }

        res.status(201).json({
            success: true,
            message: `✓ Created ${createdEvents.length} test events!`,
            events: createdEvents,
            organizerId: organizerId
        });
    } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
