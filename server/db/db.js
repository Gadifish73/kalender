const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { DEFAULT_EVENT_COLOR } = require('../eventColors');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL ist nicht gesetzt');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

const SEED_USERNAMES = ['Marc', 'Timo', 'Nicolas', 'Nicola', 'Philipp', 'Luca', 'Sascha'];
const SEED_PALETTE = ['#4f6df5', '#f5764f', '#2fb380', '#b34ff5', '#f5c04f', '#4fb8f5', '#e05d9b'];

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#4f6df5',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      all_day BOOLEAN NOT NULL DEFAULT false,
      color TEXT NOT NULL DEFAULT '${DEFAULT_EVENT_COLOR}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query('CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at)');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS saturday_checks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      saturday_date DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, saturday_date)
    )
  `);

  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n === 0) {
    for (let i = 0; i < SEED_USERNAMES.length; i++) {
      const username = SEED_USERNAMES[i];
      const passwordHash = bcrypt.hashSync(username, 10);
      await pool.query(
        'INSERT INTO users (username, password_hash, display_name, color) VALUES ($1, $2, $3, $4)',
        [username, passwordHash, username, SEED_PALETTE[i % SEED_PALETTE.length]]
      );
    }
  }
}

module.exports = { pool, init };
