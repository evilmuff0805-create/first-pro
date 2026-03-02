require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();

// ── Middleware ──
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'default-secret'));

// ── Auth helpers ──
const AUTH_COOKIE = 'auth_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function makeToken(password) {
  return crypto.createHmac('sha256', process.env.COOKIE_SECRET || 'default-secret')
    .update(password)
    .digest('hex');
}

function requireAuth(req, res, next) {
  const token = req.signedCookies[AUTH_COOKIE];
  const expected = makeToken(process.env.APP_PASSWORD || 'changeme');
  if (token === expected) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ── Auth routes (no auth required) ──
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  if (password === (process.env.APP_PASSWORD || 'changeme')) {
    const token = makeToken(password);
    res.cookie(AUTH_COOKIE, token, {
      signed: true,
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Wrong password' });
});

app.get('/api/auth-check', (req, res) => {
  const token = req.signedCookies[AUTH_COOKIE];
  const expected = makeToken(process.env.APP_PASSWORD || 'changeme');
  if (token === expected) return res.json({ ok: true });
  return res.status(401).json({ error: 'Unauthorized' });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE);
  res.json({ ok: true });
});

// ── Protected API routes ──
// (Day 2: transcribe, correct, process will be added here)

// ── Static files (served for all non-API routes) ──
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Audio-to-Text server running on port ${PORT}`);
});
