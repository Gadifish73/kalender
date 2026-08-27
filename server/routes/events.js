const express = require('express');
const { pool } = require('../db/db');
const requireAuth = require('../middleware/requireAuth');
const { EVENT_COLORS, DEFAULT_EVENT_COLOR } = require('../eventColors');

const router = express.Router();
router.use(requireAuth);

const SELECT_EVENT = `
  SELECT events.*, users.display_name, users.color AS owner_color
  FROM events JOIN users ON users.id = events.user_id
`;

async function fetchEvent(id) {
  const { rows } = await pool.query(`${SELECT_EVENT} WHERE events.id = $1`, [id]);
  return rows[0];
}

function serialize(row) {
  return {
    id: row.id,
    userId: row.user_id,
    ownerName: row.display_name,
    ownerColor: row.owner_color,
    color: row.color,
    title: row.title,
    description: row.description,
    location: row.location,
    startAt: row.start_at,
    endAt: row.end_at,
    allDay: !!row.all_day,
    generated: row.saturday_source !== null,
  };
}

function isValidDate(s) {
  return typeof s === 'string' && !Number.isNaN(new Date(s).getTime());
}

// All authenticated users see every event on the shared calendar,
// but may only edit/delete events they created.
router.get('/', async (req, res, next) => {
  try {
    const { start, end } = req.query;

    let rows;
    if (isValidDate(start) && isValidDate(end)) {
      ({ rows } = await pool.query(
        `${SELECT_EVENT} WHERE events.start_at < $1 AND events.end_at > $2 ORDER BY events.start_at`,
        [end, start]
      ));
    } else {
      ({ rows } = await pool.query(`${SELECT_EVENT} ORDER BY events.start_at`));
    }

    res.json({ events: rows.map(serialize) });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, location, startAt, endAt, allDay, color } = req.body || {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Titel ist erforderlich' });
    }
    if (!isValidDate(startAt) || !isValidDate(endAt)) {
      return res.status(400).json({ error: 'Start- und Enddatum sind erforderlich' });
    }
    if (new Date(endAt).getTime() < new Date(startAt).getTime()) {
      return res.status(400).json({ error: 'Enddatum darf nicht vor dem Startdatum liegen' });
    }

    const { rows } = await pool.query(
      `INSERT INTO events (user_id, title, description, location, start_at, end_at, all_day, color)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        req.session.userId,
        title.trim().slice(0, 200),
        typeof description === 'string' ? description.slice(0, 2000) : '',
        typeof location === 'string' ? location.slice(0, 200) : '',
        startAt,
        endAt,
        !!allDay,
        EVENT_COLORS.includes(color) ? color : DEFAULT_EVENT_COLOR,
      ]
    );

    res.status(201).json({ event: serialize(await fetchEvent(rows[0].id)) });
  } catch (err) {
    next(err);
  }
});

async function loadOwnedEvent(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    const event = rows[0];
    if (!event) {
      return res.status(404).json({ error: 'Termin nicht gefunden' });
    }
    if (event.user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Nur der Ersteller kann diesen Termin bearbeiten' });
    }
    req.event = event;
    next();
  } catch (err) {
    next(err);
  }
}

router.put('/:id', loadOwnedEvent, async (req, res, next) => {
  try {
    const { title, description, location, startAt, endAt, allDay, color } = req.body || {};
    const event = req.event;

    const newTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 200) : event.title;
    const newStart = isValidDate(startAt) ? startAt : event.start_at;
    const newEnd = isValidDate(endAt) ? endAt : event.end_at;
    const newColor = EVENT_COLORS.includes(color) ? color : event.color;

    if (new Date(newEnd).getTime() < new Date(newStart).getTime()) {
      return res.status(400).json({ error: 'Enddatum darf nicht vor dem Startdatum liegen' });
    }

    await pool.query(
      `UPDATE events SET title = $1, description = $2, location = $3, start_at = $4, end_at = $5, all_day = $6, color = $7, updated_at = now()
       WHERE id = $8`,
      [
        newTitle,
        typeof description === 'string' ? description.slice(0, 2000) : event.description,
        typeof location === 'string' ? location.slice(0, 200) : event.location,
        newStart,
        newEnd,
        allDay !== undefined ? !!allDay : event.all_day,
        newColor,
        event.id,
      ]
    );

    res.json({ event: serialize(await fetchEvent(event.id)) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', loadOwnedEvent, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM events WHERE id = $1', [req.event.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
