const express = require('express');
const { query } = require('../config/db');
const { verifyUserToken } = require('../middleware/auth');

const router = express.Router();
const GEMINI_MODEL = 'gemini-2.5-flash';

function normalizeTwoLineDescription(text, title, beachName, location) {
  const fallback = [
    `Join ${title} at ${beachName} in ${location} for a focused, community-driven beach cleanup.`,
    'Help remove shoreline waste, support segregation, and leave the coast cleaner and safer for everyone.',
  ];

  if (!text || typeof text !== 'string') {
    return fallback.join('\n');
  }

  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return `${lines[0]}\n${lines[1]}`;
  }

  const sentenceParts = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentenceParts.length >= 2) {
    return `${sentenceParts[0]}\n${sentenceParts[1]}`;
  }

  if (sentenceParts.length === 1) {
    return `${sentenceParts[0]}\n${fallback[1]}`;
  }

  return fallback.join('\n');
}

async function generateDescriptionWithGemini({ title, beachName, location }) {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    const err = new Error('Missing GEMINI_API_KEY');
    err.statusCode = 500;
    throw err;
  }

  if (typeof fetch !== 'function') {
    const err = new Error('Fetch API is not available in this Node.js runtime');
    err.statusCode = 500;
    throw err;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const prompt = [
    'Generate exactly two lines for an NGO beach-cleanup event description.',
    'Be slightly descriptive and a little elaborative, while still concise.',
    'Do not use bullet points, emojis, headings, hashtags, or numbering.',
    'Tone: warm, motivating, community-focused, and professional.',
    'Each line should be around 14 to 24 words.',
    'Line 1: mention the event purpose, beach, and location with vivid but realistic wording.',
    'Line 2: mention expected environmental impact and clearly invite volunteers to participate.',
    'Output only the two lines, separated by a newline, with no extra text.',
    '',
    `Event title: ${title}`,
    `Beach name: ${beachName}`,
    `Location: ${location}`,
  ].join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 120,
        responseMimeType: 'text/plain',
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || 'Gemini API request failed';
    const err = new Error(detail);
    err.statusCode = response.status;
    throw err;
  }

  const rawText = (payload?.candidates || [])
    .flatMap((c) => c?.content?.parts || [])
    .map((p) => p?.text || '')
    .join(' ')
    .trim();

  return normalizeTwoLineDescription(rawText, title, beachName, location);
}

function sanitizeCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function validateCoordinates(latitude, longitude) {
  if (latitude !== null && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
    return 'Latitude must be between -90 and 90';
  }
  if (longitude !== null && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
    return 'Longitude must be between -180 and 180';
  }
  if ((latitude === null) !== (longitude === null)) {
    return 'Both latitude and longitude are required for map location';
  }
  return null;
}

router.post('/generate-description', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'organizer', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const title = String(req.body?.title || '').trim();
    const beachName = String(req.body?.beach_name || '').trim();
    const location = String(req.body?.location || '').trim();

    if (!title || !beachName || !location) {
      return res.status(400).json({
        error: 'title, beach_name and location are required to generate description',
      });
    }

    const generated = await generateDescriptionWithGemini({ title, beachName, location });
    return res.status(200).json({ description: generated });
  } catch (error) {
    if (error.statusCode && Number(error.statusCode) >= 400 && Number(error.statusCode) < 500) {
      return res.status(502).json({
        error: 'Description generation provider request failed',
        details: error.message,
      });
    }

    return res.status(500).json({
      error: 'Unable to generate description right now',
      details: error.message,
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const eventsResult = await query(
      `
        SELECT
          e.id, e.title, e.description,
          e.location AS location, e.location AS beach_name,
          e.event_date, e.start_time, e.end_time, e.status, e.created_by AS created_by,
          e.poster_url, e.social_caption,
          100 AS max_volunteers,
          COUNT(r.id) as registered_count
        FROM events e
        LEFT JOIN event_registrations r ON e.id = r.event_id
        GROUP BY e.id
        ORDER BY e.event_date ASC
      `
    );

    return res.status(200).json(eventsResult.rows);
  } catch (error) {
    console.error("GET /events Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.get('/my', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const myEvents = await query(
      `
        SELECT e.id, e.title, e.description,
          e.location AS location, e.location AS beach_name,
          e.event_date, e.start_time, e.end_time, e.status, e.created_by AS created_by,
          e.poster_url, e.social_caption,
          100 AS max_volunteers,
          COUNT(r.id)::int                                        AS registered_count,
          COUNT(CASE WHEN r.status='DONE'    THEN 1 END)::int    AS done_count,
          COUNT(CASE WHEN r.status='ACTIVE'  THEN 1 END)::int    AS active_count,
          COUNT(CASE WHEN r.status='PENDING' THEN 1 END)::int    AS pending_count,
          COUNT(CASE WHEN r.status='ABSENT'  THEN 1 END)::int    AS absent_count
        FROM events e
        LEFT JOIN event_registrations r ON e.id = r.event_id
        WHERE e.created_by = $1
        GROUP BY e.id
        ORDER BY e.event_date DESC
      `,
      [req.user.userId]
    );

    return res.status(200).json(myEvents.rows);
  } catch (error) {
    console.error("GET /events/my Error:", error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

router.put('/:id', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const eventCheck = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    if (event.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const fields = [];
    const values = [];
    let idx = 1;
    const allowed = [
      'title',
      'description',
      'location',
      'latitude',
      'longitude',
      'beach_name',
      'event_date',
      'start_time',
      'end_time',
      'max_volunteers',
      'status',
    ];

    const normalizedBody = { ...req.body };
    if (Object.prototype.hasOwnProperty.call(normalizedBody, 'latitude')) {
      normalizedBody.latitude = sanitizeCoordinate(normalizedBody.latitude);
    }
    if (Object.prototype.hasOwnProperty.call(normalizedBody, 'longitude')) {
      normalizedBody.longitude = sanitizeCoordinate(normalizedBody.longitude);
    }

    const latProvided = Object.prototype.hasOwnProperty.call(normalizedBody, 'latitude');
    const lngProvided = Object.prototype.hasOwnProperty.call(normalizedBody, 'longitude');
    if (latProvided || lngProvided) {
      const latitude = latProvided ? normalizedBody.latitude : sanitizeCoordinate(event.latitude);
      const longitude = lngProvided ? normalizedBody.longitude : sanitizeCoordinate(event.longitude);
      const err = validateCoordinates(latitude, longitude);
      if (err) return res.status(400).json({ error: err });
    }

    // Explicitly parse frontend fields into DB fields
    if (normalizedBody.location) {
      normalizedBody.location = String(normalizedBody.location).trim();
    }

    for (const key of allowed) {
      if (normalizedBody[key] !== undefined) {
          if (key === 'location' || key === 'title' || key === 'description' || key === 'latitude' || key === 'longitude' || key === 'event_date' || key === 'start_time' || key === 'end_time' || key === 'status' || key === 'max_volunteers') {
           fields.push(`${key} = $${idx++}`);
           values.push(normalizedBody[key]);
        }
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE events SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.delete('/:id', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const eventCheck = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    if (event.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const active = await query(
      `SELECT COUNT(*)::int AS cnt FROM event_registrations WHERE event_id=$1 AND status='ACTIVE'`,
      [req.params.id]
    );

    if (active.rows[0].cnt > 0) {
      return res.status(400).json({ error: 'Cannot delete — volunteers are currently checked in.' });
    }

    // Remove scan logs first so historical rows do not block event deletion.
    await query(
      `
        DELETE FROM scan_logs
        WHERE registration_id IN (
          SELECT id FROM event_registrations WHERE event_id = $1
        )
      `,
      [req.params.id]
    );

    await query(`DELETE FROM events WHERE id=$1`, [req.params.id]);
    return res.status(200).json({ message: 'Event deleted.' });
  } catch (error) {
    if (error?.code === '23503') {
      return res.status(400).json({
        error: 'Cannot delete this event due to dependent records. Please remove related records first.',
      });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id/registrations/export', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const eventCheck = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    if (event.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const registrations = await query(
      `
        SELECT
          r.id, r.status, r.entry_time, r.exit_time, r.duration_mins, r.registered_at,
          u.first_name || ' ' || COALESCE(u.last_name, '')  AS volunteer_name,
          u.email AS volunteer_email,
          u.phone AS volunteer_phone
        FROM event_registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = $1
        ORDER BY r.registered_at ASC
      `,
      [req.params.id]
    );

    const header = 'Name,Email,Phone,Status,Entry Time,Exit Time,Duration (mins),Registered At\n';
    const rows = registrations.rows
      .map((r) =>
        [
          r.volunteer_name,
          r.volunteer_email,
          r.volunteer_phone || '',
          r.status,
          r.entry_time ? new Date(r.entry_time).toISOString() : '',
          r.exit_time ? new Date(r.exit_time).toISOString() : '',
          r.duration_mins || '',
          new Date(r.registered_at).toISOString(),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const csv = header + rows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="event-${req.params.id}-attendance.csv"`);
    return res.status(200).send(csv);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id/registrations', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const eventCheck = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    if (event.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const registrations = await query(
      `
        SELECT
          r.id, r.status, r.entry_time, r.exit_time, r.duration_mins, r.registered_at,
          u.first_name || ' ' || COALESCE(u.last_name, '')  AS volunteer_name,
          u.email AS volunteer_email,
          u.phone AS volunteer_phone
        FROM event_registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.event_id = $1
        ORDER BY r.registered_at ASC
      `,
      [req.params.id]
    );

    const rows = registrations.rows;
    const total = rows.length;
    const pending = rows.filter((r) => r.status === 'PENDING').length;
    const active = rows.filter((r) => r.status === 'ACTIVE').length;
    const done = rows.filter((r) => r.status === 'DONE').length;
    const absent = rows.filter((r) => r.status === 'ABSENT').length;

    return res.status(200).json({
      summary: { total, pending, active, done, absent },
      registrations: rows,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.patch('/:id/registrations/:reg_id/status', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const { status } = req.body;
    const allowedStatuses = ['PENDING', 'ACTIVE', 'DONE', 'ABSENT', 'REJECTED', 'CANCELLED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const eventCheck = await query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    if (event.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only edit your own events' });
    }

    const regCheck = await query(
      'SELECT id, entry_time, exit_time FROM event_registrations WHERE id = $1 AND event_id = $2',
      [req.params.reg_id, req.params.id]
    );

    if (regCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    let result;
    if (status === 'DONE' && regCheck.rows[0].exit_time === null) {
      result = await query(
        `
          UPDATE event_registrations
          SET status=$1, exit_time=NOW(),
              duration_mins = ROUND(EXTRACT(EPOCH FROM (NOW()-entry_time))/60)
          WHERE id=$2 RETURNING *
        `,
        [status, req.params.reg_id]
      );
    } else {
      result = await query(
        `UPDATE event_registrations SET status=$1 WHERE id=$2 RETURNING *`,
        [status, req.params.reg_id]
      );
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const eventResult = await query(
      `
        SELECT
          e.id, e.title, e.description,
          e.location AS location, e.location AS beach_name,
          e.event_date, e.start_time, e.end_time, e.status, e.created_by AS created_by,
          100 AS max_volunteers,
          COUNT(r.id) as registered_count
        FROM events e
        LEFT JOIN event_registrations r ON e.id = r.event_id
        WHERE e.id = $1
        GROUP BY e.id
      `,
      [req.params.id]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    return res.status(200).json(eventResult.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin', 'organizer'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only NGO or admin can create events' });
    }

    const {
      title,
      description,
      location,
      latitude,
      longitude,
      beach_name,
      event_date,
      start_time,
      end_time,
      max_volunteers,
    } = req.body;

    // Frontend passes beach_name instead of location mostly or location 
    const determinedLocation = location || beach_name;

    if (!title || !event_date || !start_time || !end_time) {
      return res.status(400).json({
        message: 'Missing required fields: title, event_date, start_time, end_time',
      });
    }

    const parsedLatitude = sanitizeCoordinate(latitude);
    const parsedLongitude = sanitizeCoordinate(longitude);
    const coordinateError = validateCoordinates(parsedLatitude, parsedLongitude);
    if (coordinateError) {
      return res.status(400).json({ message: coordinateError });
    }

    const createdEvent = await query(
      `
        INSERT INTO events (
          title,
          description,
          location,
          latitude,
          longitude,
          event_date,
          start_time,
          end_time,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        title,
        description || null,
        determinedLocation || 'Unknown Shore',
        parsedLatitude,
        parsedLongitude,
        event_date,
        start_time,
        end_time,
        req.user.userId,
      ]
    );

    return res.status(201).json(createdEvent.rows[0]);
  } catch (error) {
    console.error("POST /events Creation error:", error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
