const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db/db');

const router = express.Router();

function generateVoterToken() {
  return crypto.randomBytes(12).toString('hex');
}

async function fetchPublicPoll(shareToken, voterToken) {
  const { rows: pollRows } = await pool.query('SELECT * FROM polls WHERE share_token = $1', [shareToken]);
  const poll = pollRows[0];
  if (!poll) return null;

  const { rows: options } = await pool.query(
    'SELECT id, label FROM poll_options WHERE poll_id = $1 ORDER BY sort_order ASC, id ASC',
    [poll.id]
  );

  const { rows: participants } = await pool.query(
    'SELECT id, voter_token, voter_name FROM poll_participants WHERE poll_id = $1 ORDER BY created_at ASC',
    [poll.id]
  );

  const { rows: selections } = await pool.query(
    `SELECT poll_selections.participant_id, poll_selections.option_id
     FROM poll_selections
     JOIN poll_participants ON poll_participants.id = poll_selections.participant_id
     WHERE poll_participants.poll_id = $1`,
    [poll.id]
  );

  const votersByOption = new Map(options.map((o) => [o.id, []]));
  selections.forEach((s) => {
    const participant = participants.find((p) => p.id === s.participant_id);
    if (participant && votersByOption.has(s.option_id)) {
      votersByOption.get(s.option_id).push(participant.voter_name);
    }
  });

  const me = voterToken ? participants.find((p) => p.voter_token === voterToken) : null;
  const mySelections = me ? selections.filter((s) => s.participant_id === me.id).map((s) => s.option_id) : [];

  return {
    title: poll.title,
    description: poll.description,
    multiSelect: poll.multi_select,
    closed: poll.closed,
    options: options.map((o) => ({ id: o.id, label: o.label, voters: votersByOption.get(o.id) || [] })),
    you: me ? { name: me.voter_name, optionIds: mySelections } : null,
  };
}

router.get('/:token', async (req, res, next) => {
  try {
    const voterToken = typeof req.query.voterToken === 'string' ? req.query.voterToken : null;
    const poll = await fetchPublicPoll(req.params.token, voterToken);
    if (!poll) {
      return res.status(404).json({ error: 'Umfrage nicht gefunden' });
    }
    res.json({ poll });
  } catch (err) {
    next(err);
  }
});

router.post('/:token/vote', async (req, res, next) => {
  try {
    const { rows: pollRows } = await pool.query('SELECT * FROM polls WHERE share_token = $1', [req.params.token]);
    const poll = pollRows[0];
    if (!poll) {
      return res.status(404).json({ error: 'Umfrage nicht gefunden' });
    }
    if (poll.closed) {
      return res.status(403).json({ error: 'Diese Umfrage ist geschlossen' });
    }

    const { voterName, optionIds } = req.body || {};
    let { voterToken } = req.body || {};

    if (typeof voterName !== 'string' || !voterName.trim()) {
      return res.status(400).json({ error: 'Name ist erforderlich' });
    }
    if (!Array.isArray(optionIds) || optionIds.length === 0) {
      return res.status(400).json({ error: 'Mindestens eine Option auswählen' });
    }

    // Only accept option ids that actually belong to this poll.
    const { rows: validOptions } = await pool.query('SELECT id FROM poll_options WHERE poll_id = $1', [poll.id]);
    const validIds = new Set(validOptions.map((o) => o.id));
    const cleanOptionIds = [...new Set(optionIds)].filter((id) => validIds.has(id));
    if (cleanOptionIds.length === 0) {
      return res.status(400).json({ error: 'Ungültige Optionen' });
    }
    const finalOptionIds = poll.multi_select ? cleanOptionIds : [cleanOptionIds[0]];

    let participantId = null;
    if (voterToken) {
      const { rows } = await pool.query('SELECT id FROM poll_participants WHERE poll_id = $1 AND voter_token = $2', [
        poll.id,
        voterToken,
      ]);
      if (rows[0]) {
        participantId = rows[0].id;
        await pool.query('UPDATE poll_participants SET voter_name = $1, updated_at = now() WHERE id = $2', [
          voterName.trim().slice(0, 100),
          participantId,
        ]);
      }
    }

    if (!participantId) {
      voterToken = generateVoterToken();
      const { rows } = await pool.query(
        'INSERT INTO poll_participants (poll_id, voter_token, voter_name) VALUES ($1, $2, $3) RETURNING id',
        [poll.id, voterToken, voterName.trim().slice(0, 100)]
      );
      participantId = rows[0].id;
    }

    await pool.query('DELETE FROM poll_selections WHERE participant_id = $1', [participantId]);
    for (const optionId of finalOptionIds) {
      await pool.query('INSERT INTO poll_selections (participant_id, option_id) VALUES ($1, $2)', [
        participantId,
        optionId,
      ]);
    }

    const updated = await fetchPublicPoll(req.params.token, voterToken);
    res.status(200).json({ poll: updated, voterToken });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
