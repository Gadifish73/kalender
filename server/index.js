const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool, init } = require('./db/db');
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const saturdayRoutes = require('./routes/saturdays');

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Railway/Render terminate TLS at their edge and forward plain HTTP;
// this tells Express to trust their X-Forwarded-Proto header so secure
// cookies work correctly behind that proxy.
app.set('trust proxy', 1);

app.use(express.json());
app.use(
  session({
    store: new pgSession({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    },
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/saturdays', saturdayRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Serverfehler' });
});

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Kalender läuft auf http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Datenbank-Initialisierung fehlgeschlagen:', err);
    process.exit(1);
  });
