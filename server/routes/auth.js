const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/db');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, color: u.color };
}

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Benutzername und Passwort erforderlich' });
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Benutzername oder Passwort falsch' });
    }

    req.session.userId = user.id;
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.status(204).end();
  });
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({ user: null });
    }
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.session.userId]);
    const user = rows[0];
    if (!user) {
      return res.json({ user: null });
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, username, display_name, color FROM users ORDER BY id');
    res.json({ users: rows.map((u) => ({ id: u.id, username: u.username, displayName: u.display_name, color: u.color })) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
