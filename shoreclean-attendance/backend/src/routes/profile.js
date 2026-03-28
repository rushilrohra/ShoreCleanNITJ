const express = require('express');

const { query } = require('../config/db');
const { verifyUserToken } = require('../middleware/auth');

const router = express.Router();

const GREEN_POINTS_SQL = `
  (
    ROUND(COALESCE(m.total_duration_mins, 0) / 60.0 * 12)::INT
    + ROUND(COALESCE(m.total_waste_kg, 0) * 35)::INT
    + (COALESCE(m.completed_events, 0) * 40)
    + LEAST(60, COALESCE(m.checkins, 0) * 3)
    + LEAST(
        80,
        ROUND(
          CASE
            WHEN COALESCE(m.total_duration_mins, 0) > 0
              THEN (COALESCE(m.total_waste_kg, 0) / NULLIF(COALESCE(m.total_duration_mins, 0) / 60.0, 0)) * 10
            ELSE 0
          END
        )::INT
      )
    + LEAST(50, COALESCE(m.waste_entries, 0) * 2)
  )
`;

router.get('/me', verifyUserToken, async (req, res) => {
  try {
    const { userId } = req.user;

    const profileResult = await query(
      `
        WITH base_user AS (
          SELECT
            u.id,
            u.email,
            u.phone,
            u.role,
            u.created_at,
            u.first_name,
            u.last_name
          FROM users u
          WHERE u.id = $1
          LIMIT 1
        ),
        registration_metrics AS (
          SELECT
            r.user_id,
            COUNT(*) FILTER (WHERE r.entry_time IS NOT NULL) AS checkins,
            COUNT(DISTINCT r.event_id) FILTER (WHERE r.status = 'DONE') AS completed_events,
            SUM(
              CASE
                WHEN r.status = 'DONE' THEN
                  COALESCE(
                    r.duration_mins,
                    ROUND(EXTRACT(EPOCH FROM (COALESCE(r.exit_time, NOW()) - r.entry_time)) / 60.0)::INT,
                    0
                  )
                WHEN r.status = 'ACTIVE' AND r.entry_time IS NOT NULL THEN
                  GREATEST(ROUND(EXTRACT(EPOCH FROM (NOW() - r.entry_time)) / 60.0)::INT, 0)
                ELSE 0
              END
            )::INT AS total_duration_mins
          FROM event_registrations r
          WHERE r.user_id = $1
          GROUP BY r.user_id
        ),
        waste_metrics AS (
          SELECT
            wl.volunteer_id AS user_id,
            COUNT(*)::INT AS waste_entries,
            COALESCE(SUM(wl.estimated_weight_kg), 0)::NUMERIC(10,2) AS total_waste_kg
          FROM waste_logs wl
          WHERE wl.volunteer_id = $1
          GROUP BY wl.volunteer_id
        ),
        metrics AS (
          SELECT
            bu.id AS user_id,
            COALESCE(rm.checkins, 0) AS checkins,
            COALESCE(rm.completed_events, 0) AS completed_events,
            COALESCE(rm.total_duration_mins, 0) AS total_duration_mins,
            COALESCE(wm.waste_entries, 0) AS waste_entries,
            COALESCE(wm.total_waste_kg, 0)::NUMERIC(10,2) AS total_waste_kg
          FROM base_user bu
          LEFT JOIN registration_metrics rm ON rm.user_id = bu.id
          LEFT JOIN waste_metrics wm ON wm.user_id = bu.id
        ),
        scored AS (
          SELECT
            m.*,
            ROUND(m.total_duration_mins / 60.0 * 12)::INT AS time_points,
            ROUND(m.total_waste_kg * 35)::INT AS waste_points,
            (m.completed_events * 40) AS event_points,
            LEAST(60, m.checkins * 3) AS consistency_bonus,
            LEAST(
              80,
              ROUND(
                CASE
                  WHEN m.total_duration_mins > 0
                    THEN (m.total_waste_kg / NULLIF(m.total_duration_mins / 60.0, 0)) * 10
                  ELSE 0
                END
              )::INT
            ) AS efficiency_bonus,
            LEAST(50, m.waste_entries * 2) AS log_bonus,
            ${GREEN_POINTS_SQL} AS green_points
          FROM metrics m
        ),
        ranked AS (
          SELECT
            u.id AS user_id,
            ROW_NUMBER() OVER (
              ORDER BY
                COALESCE(s.green_points, 0) DESC,
                COALESCE(s.completed_events, 0) DESC,
                COALESCE(s.total_waste_kg, 0) DESC,
                u.created_at ASC
            ) AS rank
          FROM users u
          LEFT JOIN (
            SELECT
              m.user_id,
              COALESCE(m.completed_events, 0) AS completed_events,
              COALESCE(m.total_waste_kg, 0) AS total_waste_kg,
              ${GREEN_POINTS_SQL} AS green_points
            FROM (
              SELECT
                ux.id AS user_id,
                COALESCE(rm.checkins, 0) AS checkins,
                COALESCE(rm.completed_events, 0) AS completed_events,
                COALESCE(rm.total_duration_mins, 0) AS total_duration_mins,
                COALESCE(wm.waste_entries, 0) AS waste_entries,
                COALESCE(wm.total_waste_kg, 0)::NUMERIC(10,2) AS total_waste_kg
              FROM users ux
              LEFT JOIN (
                SELECT
                  r.user_id,
                  COUNT(*) FILTER (WHERE r.entry_time IS NOT NULL) AS checkins,
                  COUNT(DISTINCT r.event_id) FILTER (WHERE r.status = 'DONE') AS completed_events,
                  SUM(
                    CASE
                      WHEN r.status = 'DONE' THEN COALESCE(r.duration_mins, 0)
                      WHEN r.status = 'ACTIVE' AND r.entry_time IS NOT NULL THEN GREATEST(ROUND(EXTRACT(EPOCH FROM (NOW() - r.entry_time)) / 60.0)::INT, 0)
                      ELSE 0
                    END
                  )::INT AS total_duration_mins
                FROM event_registrations r
                GROUP BY r.user_id
              ) rm ON rm.user_id = ux.id
              LEFT JOIN (
                SELECT
                  wl.volunteer_id AS user_id,
                  COUNT(*)::INT AS waste_entries,
                  COALESCE(SUM(wl.estimated_weight_kg), 0)::NUMERIC(10,2) AS total_waste_kg
                FROM waste_logs wl
                GROUP BY wl.volunteer_id
              ) wm ON wm.user_id = ux.id
            ) m
          ) s ON s.user_id = u.id
        )
        SELECT
          bu.id,
          bu.email,
          bu.phone,
          bu.role,
          bu.created_at,
          TRIM(bu.first_name || ' ' || COALESCE(bu.last_name, '')) AS name,
          COALESCE(sc.checkins, 0) AS checkins,
          COALESCE(sc.completed_events, 0) AS completed_events,
          COALESCE(sc.total_duration_mins, 0) AS total_duration_mins,
          COALESCE(sc.waste_entries, 0) AS waste_entries,
          COALESCE(sc.total_waste_kg, 0)::NUMERIC(10,2) AS total_waste_kg,
          COALESCE(sc.time_points, 0) AS time_points,
          COALESCE(sc.waste_points, 0) AS waste_points,
          COALESCE(sc.event_points, 0) AS event_points,
          COALESCE(sc.consistency_bonus, 0) AS consistency_bonus,
          COALESCE(sc.efficiency_bonus, 0) AS efficiency_bonus,
          COALESCE(sc.log_bonus, 0) AS log_bonus,
          COALESCE(sc.green_points, 0) AS green_points,
          COALESCE(rk.rank, 0) AS rank
        FROM base_user bu
        LEFT JOIN scored sc ON sc.user_id = bu.id
        LEFT JOIN ranked rk ON rk.user_id = bu.id
      `,
      [userId]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = profileResult.rows[0];

    const activityResult = await query(
      `
        SELECT
          r.id,
          r.event_id,
          r.status,
          r.entry_time,
          r.exit_time,
          r.duration_mins,
          r.registered_at,
          e.title AS event_title,
          COALESCE(e.location_name, e.location) AS location_name,
          e.event_date
        FROM event_registrations r
        JOIN events e ON e.id = r.event_id
        WHERE r.user_id = $1
        ORDER BY COALESCE(r.exit_time, r.entry_time, r.registered_at) DESC
        LIMIT 20
      `,
      [userId]
    );

    return res.status(200).json({
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        role: profile.role,
        created_at: profile.created_at,
      },
      stats: {
        rank: Number(profile.rank || 0),
        green_points: Number(profile.green_points || 0),
        total_hours: Number(profile.total_duration_mins || 0) / 60,
        total_waste_kg: Number(profile.total_waste_kg || 0),
        completed_events: Number(profile.completed_events || 0),
        checkins: Number(profile.checkins || 0),
        waste_entries: Number(profile.waste_entries || 0),
        points_breakdown: {
          time_points: Number(profile.time_points || 0),
          waste_points: Number(profile.waste_points || 0),
          event_points: Number(profile.event_points || 0),
          consistency_bonus: Number(profile.consistency_bonus || 0),
          efficiency_bonus: Number(profile.efficiency_bonus || 0),
          log_bonus: Number(profile.log_bonus || 0),
        },
      },
      recent_activity: activityResult.rows,
    });
  } catch (error) {
    console.error('GET /api/profile/me error:', error);
    return res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
  }
});

router.get('/leaderboard', verifyUserToken, async (req, res) => {
  try {
    const leaderboardResult = await query(
      `
        WITH registration_metrics AS (
          SELECT
            r.user_id,
            COUNT(*) FILTER (WHERE r.entry_time IS NOT NULL) AS checkins,
            COUNT(DISTINCT r.event_id) FILTER (WHERE r.status = 'DONE') AS completed_events,
            SUM(
              CASE
                WHEN r.status = 'DONE' THEN COALESCE(r.duration_mins, 0)
                WHEN r.status = 'ACTIVE' AND r.entry_time IS NOT NULL THEN GREATEST(ROUND(EXTRACT(EPOCH FROM (NOW() - r.entry_time)) / 60.0)::INT, 0)
                ELSE 0
              END
            )::INT AS total_duration_mins
          FROM event_registrations r
          GROUP BY r.user_id
        ),
        waste_metrics AS (
          SELECT
            wl.volunteer_id AS user_id,
            COUNT(*)::INT AS waste_entries,
            COALESCE(SUM(wl.estimated_weight_kg), 0)::NUMERIC(10,2) AS total_waste_kg
          FROM waste_logs wl
          GROUP BY wl.volunteer_id
        ),
        metrics AS (
          SELECT
            u.id AS user_id,
            TRIM(u.first_name || ' ' || COALESCE(u.last_name, '')) AS name,
            u.role,
            u.created_at,
            COALESCE(rm.checkins, 0) AS checkins,
            COALESCE(rm.completed_events, 0) AS completed_events,
            COALESCE(rm.total_duration_mins, 0) AS total_duration_mins,
            COALESCE(wm.waste_entries, 0) AS waste_entries,
            COALESCE(wm.total_waste_kg, 0)::NUMERIC(10,2) AS total_waste_kg
          FROM users u
          LEFT JOIN registration_metrics rm ON rm.user_id = u.id
          LEFT JOIN waste_metrics wm ON wm.user_id = u.id
        ),
        scored AS (
          SELECT
            m.*,
            ${GREEN_POINTS_SQL} AS green_points
          FROM metrics m
        ),
        ranked AS (
          SELECT
            ROW_NUMBER() OVER (
              ORDER BY green_points DESC, completed_events DESC, total_waste_kg DESC, created_at ASC
            ) AS rank,
            user_id,
            name,
            role,
            green_points,
            ROUND(total_duration_mins / 60.0, 2) AS total_hours,
            total_waste_kg,
            completed_events,
            waste_entries,
            checkins
          FROM scored
        )
        SELECT *
        FROM ranked
        ORDER BY rank ASC
        LIMIT 100
      `
    );

    const myRow = leaderboardResult.rows.find((row) => String(row.user_id) === String(req.user.userId));

    return res.status(200).json({
      leaderboard: leaderboardResult.rows,
      my_rank: myRow ? Number(myRow.rank) : null,
    });
  } catch (error) {
    console.error('GET /api/profile/leaderboard error:', error);
    return res.status(500).json({ message: 'Failed to fetch leaderboard', error: error.message });
  }
});

module.exports = router;
