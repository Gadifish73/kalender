# Kalender

Mehrbenutzer-Kalender: Termine ansehen, hinzufügen, bearbeiten, löschen.

## Funktionsweise

- Keine Registrierung: beim ersten Start werden automatisch 7 feste
  Nutzer angelegt (Marc, Timo, Nicolas, Nicola, Philipp, Luca, Sascha).
  Das Start-Passwort jedes Nutzers entspricht seinem Benutzernamen und
  wird als bcrypt-Hash in der DB gespeichert (Klartext-Passwörter werden
  nie gespeichert) — siehe `server/db/db.js`.
- Anmeldung läuft über eine serverseitige Session (Nutzer per Dropdown
  auswählen + Passwort eingeben), Sessions werden ebenfalls in Postgres
  gespeichert (`connect-pg-simple`, Tabelle `session`).
- Alle angemeldeten Nutzer sehen denselben Kalender (geteilte Ansicht,
  jeder Termin ist farblich dem Ersteller zugeordnet) — bearbeiten oder
  löschen kann aber nur, wer den Termin selbst erstellt hat.
- Daten liegen in PostgreSQL (Schema `users`/`events` wird beim ersten
  Start automatisch angelegt und mit den 7 Nutzern befüllt).

## Setup

Erfordert eine erreichbare PostgreSQL-Datenbank (lokal oder gehostet,
z.B. Railway/Render/Neon).

```bash
npm install
DATABASE_URL=postgres://user:pass@host:5432/dbname npm start   # läuft auf http://localhost:3001
```

Umgebungsvariablen:

- `DATABASE_URL` — Postgres-Verbindungsstring (erforderlich)
- `SESSION_SECRET` — Secret zum Signieren der Session-Cookies (in Produktion setzen, sonst wird ein unsicherer Default verwendet)
- `PORT` — Server-Port (Standard: 3001)
- `NODE_ENV=production` — aktiviert `secure`-Cookies (erfordert HTTPS, z.B. hinter Railway/Render)

Für automatisches Neuladen bei Codeänderungen:

```bash
npm run dev
```

## Struktur

- `server/index.js` — Express-Server, Sessions (Postgres-backed), statische Auslieferung von `public/`
- `server/db/db.js` — Postgres-Verbindung + Schema-Setup (`users`, `events`) + Erstbefüllung
- `server/routes/auth.js` — Login, Logout, aktueller Nutzer, Nutzerliste
- `server/routes/events.js` — CRUD für Termine (Bearbeiten/Löschen nur durch Ersteller)
- `public/` — Frontend (vanilla JS, kein Build-Schritt): Monatsansicht + Termin-Modal
