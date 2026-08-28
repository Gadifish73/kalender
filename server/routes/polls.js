const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db/db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

function generateShareToken() {
  return crypto.randomBytes(8).toString('hex');
}

async function fetchPollWithResults(pollId) {
  const { rows: pollRows } = await pool.query('SELECT * FROM polls WHERE id = $1', [pollId]);
  const poll = pollRows[0];
  if (!poll) return null;

  const { rows: options } = await pool.query(
    'SELECT id, label FROM poll_options WHERE poll_id = $1 ORDER BY sort_order ASC, id ASC',
    [pollId]
  );

  const { rows: participants } = await pool.query(
    'SELECT id, voter_name FROM poll_participants WHERE poll_id = $1 ORDER BY created_at ASC',
    [pollId]
  );

  const { rows: selections } = await pool.query(
    `SELECT poll_selections.participant_id, poll_selections.option_id
     FROM poll_selections
     JOIN poll_participants ON poll_participants.id = poll_selections.participant_id
     WHERE poll_participants.poll_id = $1`,
    [pollId]
  );

  const votersByOption = new Map(options.map((o) => [o.id, []]));
  selections.forEach((s) => {
    const participant = participants.find((p) => p.id === s.participant_id);
    if (participant && votersByOption.has(s.option_id)) {
      votersByOption.get(s.option_id).push(participant.voter_name);
    }
  });

  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    multiSelect: poll.multi_select,
    shareToken: poll.share_token,
    closed: poll.closed,
    createdAt: poll.created_at,
    participantCount: participants.length,
    options: options.map((o) => ({ id: o.id, label: o.label, voters: votersByOption.get(o.id) || [] })),
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id FROM polls WHERE creator_user_id = $1 ORDER BY created_at DESC', [
      req.session.userId,
    ]);
    const polls = [];
    for (const row of rows) {
      polls.push(await fetchPollWithResults(row.id));
    }
    res.json({ polls });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, multiSelect, options } = req.body || {};

    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Titel ist erforderlich' });
    }
    const cleanOptions = Array.isArray(options)
      ? options.map((o) => (typeof o === 'string' ? o.trim() : '')).filter(Boolean)
      : [];
    if (cleanOptions.length < 2) {
      return res.status(400).json({ error: 'Mindestens 2 Optionen sind erforderlich' });
    }

    const shareToken = generateShareToken();
    const { rows } = await pool.query(
      `INSERT INTO polls (creator_user_id, title, description, multi_select, share_token)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        req.session.userId,
        title.trim().slice(0, 200),
        typeof description === 'string' ? description.slice(0, 2000) : '',
        multiSelect !== false,
        shareToken,
      ]
    );
    const pollId = rows[0].id;

    for (let i = 0; i < cleanOptions.length; i++) {
      await pool.query('INSERT INTO poll_options (poll_id, label, sort_order) VALUES ($1, $2, $3)', [
        pollId,
        cleanOptions[i].slice(0, 200),
        i,
      ]);
    }

    res.status(201).json({ poll: await fetchPollWithResults(pollId) });
  } catch (err) {
    next(err);
  }
});

async function loadOwnedPoll(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM polls WHERE id = $1', [req.params.id]);
    const poll = rows[0];
    if (!poll) {
      return res.status(404).json({ error: 'Umfrage nicht gefunden' });
    }
    if (poll.creator_user_id !== req.session.userId) {
      return res.status(403).json({ error: 'Nur der Ersteller kann diese Umfrage verwalten' });
    }
    req.poll = poll;
    next();
  } catch (err) {
    next(err);
  }
}

router.post('/:id/close', loadOwnedPoll, async (req, res, next) => {
  try {
    const closed = req.body && typeof req.body.closed === 'boolean' ? req.body.closed : !req.poll.closed;
    await pool.query('UPDATE polls SET closed = $1 WHERE id = $2', [closed, req.poll.id]);
    res.json({ poll: await fetchPollWithResults(req.poll.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', loadOwnedPoll, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM polls WHERE id = $1', [req.poll.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
