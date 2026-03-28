const express = require('express');
const { query } = require('../config/db');
const { verifyUserToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const eventsResult = await query(
      `
        SELECT e.*, COUNT(r.id) as registered_count
        FROM events e
        LEFT JOIN event_registrations r ON e.id = r.event_id
        GROUP BY e.id
        ORDER BY e.event_date ASC
      `
    );

    return res.status(200).json(eventsResult.rows);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/my', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const myEvents = await query(
      `
        SELECT e.*,
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
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.put('/:id', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin'].includes(req.user.role)) {
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
      'beach_name',
      'event_date',
      'start_time',
      'end_time',
      'max_volunteers',
      'status',
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(req.body[key]);
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
    if (!['ngo', 'admin'].includes(req.user.role)) {
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

    await query(`DELETE FROM events WHERE id=$1`, [req.params.id]);
    return res.status(200).json({ message: 'Event deleted.' });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

router.get('/:id/registrations/export', verifyUserToken, async (req, res) => {
  try {
    if (!['ngo', 'admin'].includes(req.user.role)) {
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
          u.name  AS volunteer_name,
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
    if (!['ngo', 'admin'].includes(req.user.role)) {
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
          u.name  AS volunteer_name,
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
    if (!['ngo', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'NGO access required' });
    }

    const { status } = req.body;
    const allowedStatuses = ['PENDING', 'ACTIVE', 'DONE', 'ABSENT'];
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
        SELECT e.*, COUNT(r.id) as registered_count
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
    if (req.user.role !== 'ngo' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only NGO or admin can create events' });
    }

    const {
      title,
      description,
      location,
      beach_name,
      event_date,
      start_time,
      end_time,
      max_volunteers,
    } = req.body;

    if (!title || !location || !beach_name || !event_date || !start_time || !end_time) {
      return res.status(400).json({
        message: 'Missing required fields: title, location, beach_name, event_date, start_time, end_time',
      });
    }

    const createdEvent = await query(
      `
        INSERT INTO events (
          title,
          description,
          location,
          beach_name,
          event_date,
          start_time,
          end_time,
          max_volunteers,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 100), $9)
        RETURNING *
      `,
      [
        title,
        description || null,
        location,
        beach_name,
        event_date,
        start_time,
        end_time,
        max_volunteers ?? null,
        req.user.userId,
      ]
    );

    return res.status(201).json(createdEvent.rows[0]);
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
