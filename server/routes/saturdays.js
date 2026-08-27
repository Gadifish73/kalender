const express = require('express');
const { pool } = require('../db/db');
const requireAuth = require('../middleware/requireAuth');
const { EVENT_CATEGORIES } = require('../eventColors');

const router = express.Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WAGENBAU_COLOR = EVENT_CATEGORIES.find((c) => c.label === 'Wagenbau').color;
const WAGENBAU_LOCATION = 'Aesch BL';

function isSaturday(dateStr) {
  // Parsed as UTC midnight; fine here since we only care about the weekday.
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay() === 6;
}

function validDate(req, res) {
  const { date } = req.params;
  if (!DATE_RE.test(date) || !isSaturday(date)) {
    res.status(400).json({ error: 'Ungültiges Datum' });
    return null;
  }
  return date;
}

// Keeps the shared "Wagenbau" calendar event for a Saturday in sync with
// who currently has that Saturday checked: creates it when the first
// person checks, updates the description as people (un)check, and
// removes it once nobody has it checked anymore.
async function syncWagenbauEvent(date) {
  const { rows: checkers } = await pool.query(
    `SELECT users.id AS user_id, users.display_name
     FROM saturday_checks
     JOIN users ON users.id = saturday_checks.user_id
     WHERE saturday_checks.saturday_date = $1
     ORDER BY saturday_checks.created_at ASC`,
    [date]
  );

  if (checkers.length === 0) {
    await pool.query('DELETE FROM events WHERE saturday_source = $1', [date]);
    return;
  }

  const description = checkers.map((c) => c.display_name).join(', ');
  const { rows: existing } = await pool.query('SELECT id FROM events WHERE saturday_source = $1', [date]);

  if (existing.length > 0) {
    await pool.query("UPDATE events SET description = $1, updated_at = now() WHERE saturday_source = $2", [
      description,
      date,
    ]);
  } else {
    await pool.query(
      `INSERT INTO events (user_id, title, description, location, start_at, end_at, all_day, color, saturday_source)
       VALUES ($1, 'Wagenbau', $2, $3, $4, $5, true, $6, $7)`,
      [checkers[0].user_id, description, WAGENBAU_LOCATION, `${date}T09:00`, `${date}T18:00`, WAGENBAU_COLOR, date]
    );
  }
}

// Returns the current user's own checked Saturdays.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT to_char(saturday_date, 'YYYY-MM-DD') AS date FROM saturday_checks WHERE user_id = $1",
      [req.session.userId]
    );
    res.json({ dates: rows.map((r) => r.date) });
  } catch (err) {
    next(err);
  }
});

router.post('/:date', async (req, res, next) => {
  try {
    const date = validDate(req, res);
    if (!date) return;

    await pool.query(
      'INSERT INTO saturday_checks (user_id, saturday_date) VALUES ($1, $2) ON CONFLICT (user_id, saturday_date) DO NOTHING',
      [req.session.userId, date]
    );
    await syncWagenbauEvent(date);
    res.status(201).json({ date });
  } catch (err) {
    next(err);
  }
});

router.delete('/:date', async (req, res, next) => {
  try {
    const date = validDate(req, res);
    if (!date) return;

    await pool.query('DELETE FROM saturday_checks WHERE user_id = $1 AND saturday_date = $2', [
      req.session.userId,
      date,
    ]);
    await syncWagenbauEvent(date);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
