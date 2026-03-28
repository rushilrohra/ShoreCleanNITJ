const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config(); // fallback to current dir

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Note: Certificates and posters are stored on Cloudinary, no local static serving needed
// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/events', require('./routes/events'));
app.use('/api/seed', require('./routes/seed'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/waste', require('./routes/waste'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/admin', require('./routes/admin'));
// ── Teammate routes (ShoreCleanNITJ) ──
app.use('/api/scan', require('./routes/scan'));              // QR check-in / check-out
app.use('/api/registrations', require('./routes/registrations')); // volunteer self-registration

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        status: err.status || 500
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`ShoreClean Backend running on port ${PORT}`);
});

module.exports = app;
