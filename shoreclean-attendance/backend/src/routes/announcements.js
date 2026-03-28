const express = require('express');
const { query } = require('../config/db');
const { verifyUserToken } = require('../middleware/auth');
const { createPoster } = require('../services/poster');
const { sendAnnouncementEmail } = require('../services/email');

const router = express.Router();

/**
 * Handle POST /api/announcements/generate-poster
 * NGOs call this to create the AI poster and captions.
 */
router.post('/generate-poster', verifyUserToken, async (req, res) => {
  try {
    const { event_id } = req.body;

    // Check permissions (Admin/Organizer check)
    if (req.user.role !== 'organizer' && req.user.role !== 'admin' && req.user.role !== 'ngo') {
      return res.status(403).json({ message: 'Only NGOs/Organizers can generate posters' });
    }

    const eventResult = await query(
      'SELECT id, title, location_name, event_date FROM events WHERE id = $1',
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const event = eventResult.rows[0];

    // Generate Poster (Stability AI + Sharp + Cloudinary + Social Captions)
    const result = await createPoster(event);

    return res.status(200).json({
      success: true,
      message: 'Poster generated successfully!',
      poster_url: result.posterUrl,
      captions: result.captions
    });
  } catch (error) {
    console.error("Poster Generation Error:", error);
    return res.status(500).json({ message: 'Failed to generate poster', error: error.message });
  }
});

/**
 * Handle POST /api/announcements/send-email
 * NGOs call this to broadcast the poster to all registered volunteers.
 */
router.post('/send-email', verifyUserToken, async (req, res) => {
  try {
    const { event_id } = req.body;

    if (req.user.role !== 'organizer' && req.user.role !== 'admin' && req.user.role !== 'ngo') {
      return res.status(403).json({ message: 'Only NGOs/Organizers can send announcements' });
    }

    const eventResult = await query(
      'SELECT title, location_name, event_date, poster_url FROM events WHERE id = $1',
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const event = eventResult.rows[0];
    if (!event.poster_url) {
      return res.status(400).json({ message: 'Please generate a poster before sending an announcement' });
    }

    // Get ALL registered volunteers and organizers on the platform
    const usersResult = await query(
      "SELECT email FROM users WHERE (role = 'volunteer' OR role = 'organizer') AND email IS NOT NULL"
    );

    const emails = usersResult.rows.map(r => r.email);

    if (emails.length === 0) {
      return res.status(400).json({ message: 'No registered volunteers found to email.' });
    }

    // Send Broadcast
    await sendAnnouncementEmail(emails, event);

    return res.status(200).json({
      success: true,
      message: `Event invitation successfully broadcasted to all ${emails.length} volunteers and organizers on the platform.`
    });
  } catch (error) {
    console.error("Announcement Email Error:", error);
    return res.status(500).json({ message: 'Failed to send announcement', error: error.message });
  }
});

module.exports = router;
