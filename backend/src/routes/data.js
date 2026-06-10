import { Router } from 'express';
import pool        from '../db/pool.js';

const router = Router();

/* Middleware — require a valid session */
function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Unauthorised.' });
  next();
}

// ─────────────────────────────────────────────
// Activities
// ─────────────────────────────────────────────

/* GET /api/activities */
router.get('/activities', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM activities ORDER BY created_at');
    res.json(rows.map(toActivity));
  } catch (err) {
    console.error('[GET /activities]', err.message);
    res.status(500).json({ error: 'Failed to load activities.' });
  }
});

/* POST /api/activities */
router.post('/activities', requireAuth, async (req, res) => {
  const { id, name, icon, color } = req.body;
  if (!id || !name || !icon || !color) return res.status(400).json({ error: 'id, name, icon and color are required.' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO activities (id, name, icon, color, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [id, name.trim(), icon, color, req.session.userId],
    );
    res.status(201).json(toActivity(rows[0]));
  } catch (err) {
    console.error('[POST /activities]', err.message);
    res.status(500).json({ error: 'Failed to create activity.' });
  }
});

/* PUT /api/activities/:id */
router.put('/activities/:id', requireAuth, async (req, res) => {
  const { name, icon, color } = req.body;
  if (!name || !icon || !color) return res.status(400).json({ error: 'name, icon and color are required.' });
  try {
    await pool.query(
      'UPDATE activities SET name=$1, icon=$2, color=$3 WHERE id=$4',
      [name.trim(), icon, color, req.params.id],
    );
    // Propagate rename/recolour to all existing events
    await pool.query(
      'UPDATE events SET activity_name=$1, activity_color=$2, activity_icon=$3 WHERE activity_id=$4',
      [name.trim(), color, icon, req.params.id],
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /activities/:id]', err.message);
    res.status(500).json({ error: 'Failed to update activity.' });
  }
});

/* DELETE /api/activities/:id */
router.delete('/activities/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM activities WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /activities/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete activity.' });
  }
});

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

/* GET /api/events */
router.get('/events', requireAuth, async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM events ORDER BY date, created_at');
    res.json(rows.map(toEvent));
  } catch (err) {
    console.error('[GET /events]', err.message);
    res.status(500).json({ error: 'Failed to load events.' });
  }
});

/* POST /api/events */
router.post('/events', requireAuth, async (req, res) => {
  const { id, activityId, activityName, activityColor, activityIcon, date } = req.body;
  if (!id || !activityId || !activityName || !activityColor || !activityIcon || !date) {
    return res.status(400).json({ error: 'All event fields are required.' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO events
         (id, activity_id, activity_name, activity_color, activity_icon, date,
          proposed_by, proposed_by_name, proposed_by_username)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [id, activityId, activityName, activityColor, activityIcon, date,
       req.session.userId, req.session.name, req.session.username],
    );
    res.status(201).json(toEvent(rows[0]));
  } catch (err) {
    console.error('[POST /events]', err.message);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

/* PUT /api/events/:id/date  (drag-to-reschedule) */
router.put('/events/:id/date', requireAuth, async (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required.' });
  try {
    await pool.query('UPDATE events SET date=$1 WHERE id=$2', [date, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[PUT /events/:id/date]', err.message);
    res.status(500).json({ error: 'Failed to move event.' });
  }
});

/* DELETE /api/events/:id */
router.delete('/events/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT proposed_by FROM events WHERE id=$1', [req.params.id]);
    if (!rows.length)                         return res.status(404).json({ error: 'Event not found.' });
    if (rows[0].proposed_by !== req.session.userId) return res.status(403).json({ error: 'You can only remove your own events.' });
    await pool.query('DELETE FROM events WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /events/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete event.' });
  }
});

// ─────────────────────────────────────────────
// Row mappers — normalise DB column names to camelCase
// ─────────────────────────────────────────────
function toActivity(row) {
  return {
    id:        row.id,
    name:      row.name,
    icon:      row.icon,
    color:     row.color,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function toEvent(row) {
  return {
    id:                  row.id,
    activityId:          row.activity_id,
    activityName:        row.activity_name,
    activityColor:       row.activity_color,
    activityIcon:        row.activity_icon,
    date:                typeof row.date === 'string' ? row.date : row.date.toISOString().slice(0, 10),
    proposedBy:          row.proposed_by,
    proposedByName:      row.proposed_by_name,
    proposedByUsername:  row.proposed_by_username,
    createdAt:           row.created_at,
  };
}

export default router;
