const express = require('express');
const { pool } = require('../db/db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
