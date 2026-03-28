const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const multer = require('multer');
const ExifParser = require('exif-parser');
const path = require('path');
const fs = require('fs');

// Configure multer for file storage on disk
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../../uploads/photos');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${file.originalname}`);
    }
});

const upload = multer({ storage });

// Upload waste photo
router.post('/upload', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
        const { eventId } = req.body;
        const volunteerId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let photoGpsLat = null;
        let photoGpsLong = null;
        let photoTimestamp = null;

        // Extract EXIF data from uploaded file
        try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const parser = ExifParser.create(fileBuffer);
            const result = parser.parse();

            if (result.tags.GPSLatitude && result.tags.GPSLongitude) {
                photoGpsLat = result.tags.GPSLatitude;
                photoGpsLong = result.tags.GPSLongitude;
            }
            if (result.tags.DateTime) {
                photoTimestamp = new Date(result.tags.DateTime);
            }
        } catch (exifError) {
            console.warn('Could not parse EXIF data:', exifError);
        }

        // Get event details
        const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        const event = eventResult.rows[0];

        if (photoGpsLat && photoGpsLong) {
            const { calculateDistance } = require('../utils/geofencing');
            const distance = calculateDistance(photoGpsLat, photoGpsLong, event.latitude, event.longitude);

            if (distance > 500) {
                await pool.query(
                    `INSERT INTO fraud_flags (volunteer_id, event_id, flag_type, description, severity)
           VALUES ($1, $2, 'gps_mismatch', 'Photo location outside event area', 'medium')`,
                    [volunteerId, eventId]
                );
                return res.status(403).json({ error: 'Photo location does not match event location' });
            }
        }

        // Store file path and generate URL
        const photoFileName = req.file.filename;
        const photoUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/photos/${photoFileName}`;

        // TODO: Run AI classification (Gemini API)
        const aiClassification = {
            waste_type: 'plastic',
            weight_category: 'medium',
            confidence: 85
        };

        // Insert waste log
        const result = await pool.query(
            `INSERT INTO waste_logs (volunteer_id, event_id, photo_url, photo_gps_latitude, photo_gps_longitude, photo_timestamp, waste_type, ai_confidence, ai_classification, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
       RETURNING *`,
            [volunteerId, eventId, photoUrl, photoGpsLat, photoGpsLong, photoTimestamp, aiClassification.waste_type, aiClassification.confidence / 100, JSON.stringify(aiClassification)]
        );

        res.status(201).json({ waste_log: result.rows[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
