#!/usr/bin/env node
/**
 * Sentinel Server
 * Multi-user self-hosted monitoring server with SQLite storage and Bearer token auth.
 * Drop-in replacement for the local file-based dashboard/server.js
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { authMiddleware, requireAdmin } = require('./auth');
const { ProbeGenerator, PROBE_TEMPLATES } = require('../agent/probe-generator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── PUBLIC ROUTES (no auth) ────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), version: '2.0.0' });
});

// Check whether first-run setup has been completed
app.get('/api/setup/status', (req, res) => {
  res.json({ setupRequired: !db.isSetupDone() });
});

// First-run: create admin account and generate first token
app.post('/api/setup/init', async (req, res) => {
  if (db.isSetupDone()) {
    return res.status(409).json({ error: 'Setup already completed' });
  }

  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    await db.createAdmin(email, password);
    const userId = db.createUser(email, name || 'Admin', 'admin');
    const { token } = db.createToken(userId, 'Default Admin Token');
    res.json({
      ok: true,
      token,
      message: 'Setup complete. Copy this token — it will not be shown again.',
    });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Dashboard web login (email + password → Bearer token)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  const admin = await db.verifyAdmin(email, password);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = db.getUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const { token } = db.createToken(user.id, `Dashboard ${new Date().toISOString()}`);
  res.json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// Serve setup wizard page
app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'setup.html'));
});

// Root: redirect to /setup if not configured yet
app.get('/', (req, res, next) => {
  if (!db.isSetupDone()) {
    return res.redirect('/setup');
  }
  next();
});

// ─── PROTECTED API ROUTER ───────────────────────────────────────────────────

const api = express.Router();
api.use(authMiddleware);
app.use('/api', api);

// POST /api/findings — receive a finding from a monitoring agent
api.post('/findings', (req, res) => {
  try {
    const finding = req.body;

    if (!finding || !finding.session_id) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    // Normalise nested probe fields (agents send probe: { title, question, severity })
    if (!finding.probe_question && finding.probe && finding.probe.question) {
      finding.probe_question = finding.probe.question;
    }
    if (!finding.probe_title && finding.probe && finding.probe.title) {
      finding.probe_title = finding.probe.title;
    }
    if (!finding.severity && finding.probe && finding.probe.severity) {
      finding.severity = finding.probe.severity;
    }

    finding.user_id = req.user.id;

    // Ensure the session record exists
    db.upsertSession(
      finding.session_id,
      req.user.id,
      finding.workspace || null,
      finding.business_type || null,
      finding.business_confidence || 0,
      finding.timestamp || new Date().toISOString(),
      {}
    );

    const id = db.createFinding(finding);

    console.log(`[Finding] user=${req.user.email} session=${finding.session_id} score=${finding.score} grade=${finding.grade}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error('Error in POST /api/findings:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/heartbeat — agent pushes live session state
api.post('/sessions/heartbeat', (req, res) => {
  try {
    const state = req.body;
    if (!state || !state.session_id) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    db.upsertSession(
      state.session_id,
      req.user.id,
      state.workspace || null,
      state.business_type || null,
      state.business_confidence || 0,
      state.started_at || new Date().toISOString(),
      state
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Error in POST /api/sessions/heartbeat:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions — list sessions (admin sees all, others see own)
api.get('/sessions', (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const sessions = db.listSessions(req.user.id, isAdmin);
    res.json({ sessions, count: sessions.length, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error in GET /api/sessions:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id — session detail + findings
api.get('/sessions/:id', (req, res) => {
  try {
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user.role !== 'admin' && session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const findings = db.listFindingsForSession(req.params.id);
    res.json({ session, findings, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error in GET /api/sessions/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:id/activity — structured activity timeline
api.get('/sessions/:id/activity', (req, res) => {
  try {
    const session = db.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user.role !== 'admin' && session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const findings = db.listFindingsForSession(req.params.id);

    const activities = findings.map(f => ({
      id: `finding-${f.id}`,
      type: 'probe_exchange',
      timestamp: f.timestamp,
      data: {
        probeTitle: f.probe_title,
        question: f.probe_question,
        response: f.response,
        score: f.score,
        grade: f.grade,
        assessment: f.assessment,
        severity: f.severity,
        signals: JSON.parse(f.signals_json || '[]'),
        businessType: f.business_type,
      },
    }));

    activities.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json({ activities, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error in GET /api/sessions/:id/activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/raids — launch a manual, on-demand raid
// Creates a session and returns a scripted set of probes for the frontend
// to animate turn-by-turn. Findings are POSTed back to /api/findings as the
// raid plays out. Manual raids are marked with workspace "manual-raid:<id>"
// so they can be filtered out of passive-monitoring views.
api.post('/raids', (req, res) => {
  try {
    const {
      business_type,
      probe_count = 6,
      target = null,
      capabilities = {},
    } = req.body || {};

    if (!business_type) {
      return res.status(400).json({ error: 'business_type required' });
    }
    if (!Object.prototype.hasOwnProperty.call(PROBE_TEMPLATES, business_type)) {
      return res.status(400).json({
        error: `unknown business_type "${business_type}"`,
        supported: Object.keys(PROBE_TEMPLATES),
      });
    }
    const n = Math.max(1, Math.min(20, Number(probe_count) || 6));

    const sessionId = `raid-${crypto.randomBytes(6).toString('hex')}`;
    const workspace = `manual-raid:${sessionId}`;
    const startedAt = new Date().toISOString();

    db.upsertSession(
      sessionId,
      req.user.id,
      workspace,
      business_type,
      100,
      startedAt,
      {
        manual: true,
        target: target || null,
        probe_count: n,
      }
    );

    const generator = new ProbeGenerator(business_type, capabilities);
    const all = generator.generateProbes();
    // Shuffle deterministically-ish and slice N
    const shuffled = [...all].sort(() => Math.random() - 0.5).slice(0, n);

    console.log(
      `[Raid] user=${req.user.email} session=${sessionId} business=${business_type} probes=${shuffled.length}`
    );

    res.status(201).json({
      ok: true,
      session_id: sessionId,
      workspace,
      business_type,
      probes: shuffled.map((p) => ({
        id: p.id,
        title: p.title,
        question: p.probe,
        risk: p.risk,
        severity: p.severity,
      })),
    });
  } catch (err) {
    console.error('Error in POST /api/raids:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/findings — list findings with optional filters
api.get('/findings', (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let findings = db.listFindings(req.user.id, isAdmin);

    const { session, businessType, grade, minScore, maxScore, search } = req.query;
    if (session) findings = findings.filter(f => f.session_id === session);
    if (businessType) findings = findings.filter(f => f.business_type === businessType);
    if (grade) findings = findings.filter(f => f.grade === grade);
    if (minScore) findings = findings.filter(f => f.score >= parseInt(minScore));
    if (maxScore) findings = findings.filter(f => f.score <= parseInt(maxScore));
    if (search) {
      const s = search.toLowerCase();
      findings = findings.filter(
        f =>
          (f.probe_question && f.probe_question.toLowerCase().includes(s)) ||
          (f.response && f.response.toLowerCase().includes(s))
      );
    }

    res.json({ findings, count: findings.length, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Error in GET /api/findings:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stats — overall statistics
api.get('/stats', (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const findings = db.listFindings(req.user.id, isAdmin);
    const sessions = db.listSessions(req.user.id, isAdmin);

    const scores = findings.map(f => f.score).filter(s => s != null);
    const averageScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const gradeDistribution = findings.reduce((acc, f) => {
      const g = f.grade || 'Unknown';
      acc[g] = (acc[g] || 0) + 1;
      return acc;
    }, {});

    const businessTypeDistribution = findings.reduce((acc, f) => {
      const t = f.business_type || 'Unknown';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});

    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const activeSessions = sessions.filter(
      s => new Date(s.updated_at).getTime() > fiveMinAgo
    ).length;

    res.json({
      totalFindings: findings.length,
      averageScore,
      gradeDistribution,
      businessTypeDistribution,
      activeSessions,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error in GET /api/stats:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/active — sessions with recent activity
api.get('/active', (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const sessions = db.listSessions(req.user.id, isAdmin);
    const fiveMinAgo = Date.now() - 5 * 60 * 1000;
    const active = sessions.filter(s => new Date(s.updated_at).getTime() > fiveMinAgo);
    res.json({ sessions: active, count: active.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/alerts — critical findings (score < 50)
api.get('/alerts', (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const alerts = db.getAlerts(req.user.id, isAdmin);
    res.json({ alerts, count: alerts.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/export — CSV export
api.get('/export', (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const findings = db.listFindings(req.user.id, isAdmin);

    const headers = [
      'Timestamp', 'Session ID', 'User', 'Business Type',
      'Probe', 'Score', 'Grade', 'Severity', 'Response (truncated)',
    ];
    const rows = findings.map(f => [
      f.timestamp,
      f.session_id,
      f.user_id || '',
      f.business_type || '',
      `"${(f.probe_question || '').replace(/"/g, '""')}"`,
      f.score,
      f.grade || '',
      f.severity || '',
      `"${(f.response || '').substring(0, 200).replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=sentinel-findings.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN ROUTES ────────────────────────────────────────────────────────────

// GET /api/admin/users
api.get('/admin/users', requireAdmin, (req, res) => {
  try {
    res.json({ users: db.listUsers() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/users — create a new user account
api.post('/admin/users', requireAdmin, (req, res) => {
  try {
    const { email, name, role = 'developer' } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'email and name required' });
    }
    if (!['admin', 'developer', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'role must be admin, developer, or viewer' });
    }
    const id = db.createUser(email, name, role);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/tokens — list all tokens
api.get('/admin/tokens', requireAdmin, (req, res) => {
  try {
    res.json({ tokens: db.listAllTokens() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/tokens — generate a token for any user
api.post('/admin/tokens', requireAdmin, (req, res) => {
  try {
    const { user_id, name = 'API Token' } = req.body;
    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }
    const { id, token } = db.createToken(user_id, name);
    res.status(201).json({ ok: true, id, token, message: 'Save this token — it will not be shown again.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/tokens/:id — revoke any token
api.delete('/admin/tokens/:id', requireAdmin, (req, res) => {
  try {
    db.revokeTokenAdmin(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SELF-SERVICE TOKEN ROUTES ───────────────────────────────────────────────

// GET /api/tokens — list my tokens
api.get('/tokens', (req, res) => {
  try {
    res.json({ tokens: db.listTokensForUser(req.user.id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tokens — generate a new token for myself
api.post('/tokens', (req, res) => {
  try {
    const { name = 'My Token' } = req.body;
    const { id, token } = db.createToken(req.user.id, name);
    res.status(201).json({ ok: true, id, token, message: 'Save this token — it will not be shown again.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tokens/:id — revoke my own token
api.delete('/tokens/:id', (req, res) => {
  try {
    const result = db.revokeToken(req.params.id, req.user.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Token not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── START ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       🛡️  SENTINEL SERVER v2.0 STARTED                ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  URL:     http://localhost:${PORT}`);
  console.log(`  API:     http://localhost:${PORT}/api/stats`);
  console.log(`  Setup:   http://localhost:${PORT}/setup`);
  console.log('');
  if (!db.isSetupDone()) {
    console.log('  ⚠️  First run — visit /setup to create your admin account');
    console.log('');
  }
  console.log('  Press Ctrl+C to stop');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});
