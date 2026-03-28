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
      'SELECT id, title, location AS location_name, event_date FROM events WHERE id = $1',
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
      'SELECT title, location AS location_name, event_date, poster_url FROM events WHERE id = $1',
      [event_id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const event = eventResult.rows[0];
    if (!event.poster_url) {
      return res.status(400).json({ message: 'Please generate a poster before sending an announcement' });
    }

    // Get recipients registered for this specific event.
    const usersResult = await query(
      `
        SELECT DISTINCT u.email
        FROM event_registrations er
        JOIN users u ON u.id = er.user_id
        WHERE er.event_id = $1
          AND u.email IS NOT NULL
          AND TRIM(u.email) <> ''
          AND er.status IN ('PENDING', 'ACTIVE', 'DONE')
      `,
      [event_id]
    );

    const emails = usersResult.rows.map((r) => r.email);

    if (emails.length === 0) {
      return res.status(400).json({ message: 'No registered users found for this event.' });
    }

    const delivery = await sendAnnouncementEmail(emails, event);
    if (!delivery.ok) {
      return res.status(502).json({
        message: 'Announcement email delivery failed. Verify EMAIL_USER/EMAIL_PASS and SMTP access.',
        details: delivery.error,
        sent_count: delivery.sentCount,
        failed_count: delivery.failedCount,
      });
    }

    const partial = delivery.failedCount > 0;

    return res.status(200).json({
      success: true,
      message: partial
        ? `Announcement sent to ${delivery.sentCount} users (${delivery.failedCount} failed).`
        : `Announcement sent to all ${delivery.sentCount} registered users.`,
      sent_count: delivery.sentCount,
      failed_count: delivery.failedCount,
    });
  } catch (error) {
    console.error("Announcement Email Error:", error);
    return res.status(500).json({ message: 'Failed to send announcement', error: error.message });
  }
});

module.exports = router;
