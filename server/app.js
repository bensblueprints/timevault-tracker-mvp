const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const { openDb } = require('./db');
const { durationSec, flagOverlaps, buildReport, reportCsv } = require('./reports');

function createApp(opts = {}) {
  const dataDir = opts.dataDir || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const adminPassword = opts.adminPassword || process.env.ADMIN_PASSWORD || 'admin';
  const autologinToken = opts.autologinToken || process.env.AUTOLOGIN_TOKEN || null;

  const db = openDb(dataDir);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // ---- sessions (in-memory, simple by design) ----
  const sessions = new Set();
  function newSession(res) {
    const sid = crypto.randomBytes(24).toString('hex');
    sessions.add(sid);
    res.cookie('sid', sid, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
    return sid;
  }
  function requireAuth(req, res, next) {
    if (req.cookies.sid && sessions.has(req.cookies.sid)) return next();
    res.status(401).json({ error: 'Unauthorized' });
  }

  // ================= AUTH =================

  app.post('/api/login', (req, res) => {
    const pw = String(req.body?.password || '');
    const a = Buffer.from(pw);
    const b = Buffer.from(adminPassword);
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });
    newSession(res);
    res.json({ ok: true });
  });

  app.post('/api/logout', (req, res) => {
    sessions.delete(req.cookies.sid);
    res.clearCookie('sid');
    res.json({ ok: true });
  });

  app.get('/api/me', (req, res) => {
    res.json({ authed: !!(req.cookies.sid && sessions.has(req.cookies.sid)) });
  });

  // desktop-mode auto-login
  if (autologinToken) {
    app.get('/auth/auto', (req, res) => {
      if (req.query.token !== autologinToken) return res.status(403).send('Forbidden');
      newSession(res);
      res.redirect('/');
    });
  }

  // ================= HELPERS =================

  const nowIso = () => new Date().toISOString();

  function parseIso(v) {
    if (!v) return null;
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }

  function hydrateEntries(rows) {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    const tagRows = db
      .prepare(
        `SELECT et.entry_id, t.id AS tag_id, t.name FROM entry_tags et JOIN tags t ON t.id = et.tag_id
         WHERE et.entry_id IN (${placeholders}) ORDER BY t.name`
      )
      .all(...ids);
    const byEntry = new Map();
    for (const tr of tagRows) {
      if (!byEntry.has(tr.entry_id)) byEntry.set(tr.entry_id, []);
      byEntry.get(tr.entry_id).push({ id: tr.tag_id, name: tr.name });
    }
    return rows.map((r) => ({
      ...r,
      billable: !!r.billable,
      tag_objects: byEntry.get(r.id) || [],
      tags: (byEntry.get(r.id) || []).map((t) => t.name),
      duration: durationSec(r)
    }));
  }

  const ENTRY_SELECT = `
    SELECT e.id, e.description, e.project_id, e.start, e.stop,
           p.name AS project_name, p.color AS project_color, p.billable, p.hourly_rate,
           c.id AS client_id, c.name AS client_name
    FROM entries e
    LEFT JOIN projects p ON p.id = e.project_id
    LEFT JOIN clients c ON c.id = p.client_id`;

  function getEntry(id) {
    const row = db.prepare(`${ENTRY_SELECT} WHERE e.id = ?`).get(id);
    return row ? hydrateEntries([row])[0] : null;
  }

  function setEntryTags(entryId, tagIds) {
    db.prepare('DELETE FROM entry_tags WHERE entry_id = ?').run(entryId);
    const ins = db.prepare('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)');
    for (const t of tagIds || []) ins.run(entryId, t);
  }

  function rangeEntries(from, to) {
    let sql = `${ENTRY_SELECT}`;
    const where = [];
    const params = [];
    if (from) { where.push('e.start >= ?'); params.push(from); }
    if (to) { where.push('e.start <= ?'); params.push(to); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY e.start DESC';
    return hydrateEntries(db.prepare(sql).all(...params));
  }

  // ================= CLIENTS =================

  app.get('/api/clients', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM clients ORDER BY name').all());
  });

  app.post('/api/clients', requireAuth, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const info = db.prepare('INSERT INTO clients (name) VALUES (?)').run(name);
    res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid));
  });

  app.put('/api/clients/:id', requireAuth, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    db.prepare('UPDATE clients SET name = ? WHERE id = ?').run(name, req.params.id);
    res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
  });

  app.delete('/api/clients/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= PROJECTS =================

  const projectFields = (b, existing = {}) => ({
    name: String(b.name ?? existing.name ?? '').trim(),
    client_id: b.client_id !== undefined ? (b.client_id ? Number(b.client_id) : null) : existing.client_id ?? null,
    color: String(b.color ?? existing.color ?? '#3987e5'),
    billable: b.billable !== undefined ? (b.billable ? 1 : 0) : existing.billable ?? 1,
    hourly_rate: b.hourly_rate !== undefined ? Math.max(0, Number(b.hourly_rate) || 0) : existing.hourly_rate ?? 0,
    archived: b.archived !== undefined ? (b.archived ? 1 : 0) : existing.archived ?? 0
  });

  app.get('/api/projects', requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT p.*, c.name AS client_name,
           (SELECT COUNT(*) FROM entries e WHERE e.project_id = p.id) AS entry_count
         FROM projects p LEFT JOIN clients c ON c.id = p.client_id ORDER BY p.archived, p.name`
      )
      .all();
    res.json(rows);
  });

  app.post('/api/projects', requireAuth, (req, res) => {
    const f = projectFields(req.body || {});
    if (!f.name) return res.status(400).json({ error: 'Name required' });
    const info = db
      .prepare('INSERT INTO projects (name, client_id, color, billable, hourly_rate, archived) VALUES (@name, @client_id, @color, @billable, @hourly_rate, @archived)')
      .run(f);
    res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid));
  });

  app.put('/api/projects/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const f = projectFields(req.body || {}, existing);
    if (!f.name) return res.status(400).json({ error: 'Name required' });
    db.prepare(
      'UPDATE projects SET name=@name, client_id=@client_id, color=@color, billable=@billable, hourly_rate=@hourly_rate, archived=@archived WHERE id=@id'
    ).run({ ...f, id: existing.id });
    res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(existing.id));
  });

  app.delete('/api/projects/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= TAGS =================

  app.get('/api/tags', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT * FROM tags ORDER BY name').all());
  });

  app.post('/api/tags', requireAuth, (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Name required' });
    const existing = db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
    if (existing) return res.json(existing);
    const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
    res.status(201).json(db.prepare('SELECT * FROM tags WHERE id = ?').get(info.lastInsertRowid));
  });

  app.delete('/api/tags/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM tags WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= TIMER =================
  // The running timer is server state: an entry row with stop = NULL.
  // It survives page reloads, browser restarts, even server restarts.

  function runningEntry() {
    const row = db.prepare(`${ENTRY_SELECT} WHERE e.stop IS NULL ORDER BY e.start DESC LIMIT 1`).get();
    return row ? hydrateEntries([row])[0] : null;
  }

  app.get('/api/timer/status', requireAuth, (req, res) => {
    const running = runningEntry();
    const elapsed = running ? Math.max(0, Math.round((Date.now() - Date.parse(running.start)) / 1000)) : 0;
    res.json({ running, elapsed });
  });

  app.post('/api/timer/start', requireAuth, (req, res) => {
    // Starting a new timer stops any currently running one (Toggl behavior).
    const current = db.prepare('SELECT id FROM entries WHERE stop IS NULL').get();
    if (current) db.prepare('UPDATE entries SET stop = ? WHERE id = ?').run(nowIso(), current.id);

    const b = req.body || {};
    const info = db
      .prepare('INSERT INTO entries (description, project_id, start) VALUES (?, ?, ?)')
      .run(String(b.description || ''), b.project_id ? Number(b.project_id) : null, nowIso());
    setEntryTags(info.lastInsertRowid, b.tag_ids);
    res.status(201).json(getEntry(info.lastInsertRowid));
  });

  app.post('/api/timer/stop', requireAuth, (req, res) => {
    const current = db.prepare('SELECT id FROM entries WHERE stop IS NULL').get();
    if (!current) return res.status(404).json({ error: 'No timer running' });
    db.prepare('UPDATE entries SET stop = ? WHERE id = ?').run(nowIso(), current.id);
    res.json(getEntry(current.id));
  });

  app.post('/api/timer/discard', requireAuth, (req, res) => {
    const current = db.prepare('SELECT id FROM entries WHERE stop IS NULL').get();
    if (!current) return res.status(404).json({ error: 'No timer running' });
    db.prepare('DELETE FROM entries WHERE id = ?').run(current.id);
    res.json({ ok: true });
  });

  // Continue a previous entry: start a fresh timer with the same description/project/tags.
  app.post('/api/timer/continue/:id', requireAuth, (req, res) => {
    const src = getEntry(req.params.id);
    if (!src) return res.status(404).json({ error: 'Not found' });
    const current = db.prepare('SELECT id FROM entries WHERE stop IS NULL').get();
    if (current) db.prepare('UPDATE entries SET stop = ? WHERE id = ?').run(nowIso(), current.id);
    const info = db
      .prepare('INSERT INTO entries (description, project_id, start) VALUES (?, ?, ?)')
      .run(src.description, src.project_id, nowIso());
    setEntryTags(info.lastInsertRowid, src.tag_objects.map((t) => t.id));
    res.status(201).json(getEntry(info.lastInsertRowid));
  });

  // ================= ENTRIES =================

  app.get('/api/entries', requireAuth, (req, res) => {
    const from = parseIso(req.query.from);
    const to = parseIso(req.query.to);
    let entries = rangeEntries(from, to);
    if (!from && !to) entries = entries.slice(0, 200); // recent entries cap
    res.json(flagOverlaps(entries));
  });

  // Manual entry: { description, project_id, tag_ids, start, stop } or { start, duration_seconds }
  app.post('/api/entries', requireAuth, (req, res) => {
    const b = req.body || {};
    const start = parseIso(b.start);
    if (!start) return res.status(400).json({ error: 'Valid start required' });
    let stop = parseIso(b.stop);
    if (!stop && b.duration_seconds) {
      stop = new Date(Date.parse(start) + Number(b.duration_seconds) * 1000).toISOString();
    }
    if (!stop) return res.status(400).json({ error: 'stop or duration_seconds required' });
    if (Date.parse(stop) <= Date.parse(start)) return res.status(400).json({ error: 'stop must be after start' });

    const info = db
      .prepare('INSERT INTO entries (description, project_id, start, stop) VALUES (?, ?, ?, ?)')
      .run(String(b.description || ''), b.project_id ? Number(b.project_id) : null, start, stop);
    setEntryTags(info.lastInsertRowid, b.tag_ids);

    const entry = getEntry(info.lastInsertRowid);
    // Overlap check against neighbours on the same days.
    const dayFrom = new Date(Date.parse(start) - 86400000).toISOString();
    const dayTo = new Date(Date.parse(stop) + 86400000).toISOString();
    const flagged = flagOverlaps(rangeEntries(dayFrom, dayTo));
    const me = flagged.find((e) => e.id === entry.id);
    res.status(201).json({ ...entry, overlap: !!(me && me.overlap) });
  });

  app.put('/api/entries/:id', requireAuth, (req, res) => {
    const existing = db.prepare('SELECT * FROM entries WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const start = b.start !== undefined ? parseIso(b.start) : existing.start;
    let stop = b.stop !== undefined ? parseIso(b.stop) : existing.stop;
    if (b.duration_seconds !== undefined && start) {
      stop = new Date(Date.parse(start) + Number(b.duration_seconds) * 1000).toISOString();
    }
    if (!start) return res.status(400).json({ error: 'Valid start required' });
    if (stop && Date.parse(stop) <= Date.parse(start)) return res.status(400).json({ error: 'stop must be after start' });

    db.prepare('UPDATE entries SET description = ?, project_id = ?, start = ?, stop = ? WHERE id = ?').run(
      b.description !== undefined ? String(b.description) : existing.description,
      b.project_id !== undefined ? (b.project_id ? Number(b.project_id) : null) : existing.project_id,
      start,
      stop,
      existing.id
    );
    if (b.tag_ids !== undefined) setEntryTags(existing.id, b.tag_ids);
    res.json(getEntry(existing.id));
  });

  app.delete('/api/entries/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM entries WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ================= REPORTS =================

  function reportParams(req) {
    const from = parseIso(req.query.from);
    const to = parseIso(req.query.to);
    const groupBy = ['project', 'client', 'tag', 'day'].includes(req.query.group) ? req.query.group : 'project';
    const rounding = [0, 5, 15].includes(Number(req.query.rounding)) ? Number(req.query.rounding) : 0;
    return { from, to, groupBy, rounding };
  }

  app.get('/api/reports', requireAuth, (req, res) => {
    const { from, to, groupBy, rounding } = reportParams(req);
    const entries = rangeEntries(from, to);
    const report = buildReport(entries, { groupBy, rounding });
    res.json({ ...report, groupBy, rounding, from, to });
  });

  app.get('/api/reports.csv', requireAuth, (req, res) => {
    const { from, to, rounding } = reportParams(req);
    const entries = rangeEntries(from, to).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    res.set('Content-Disposition', 'attachment; filename="timevault-report.csv"');
    res.type('text/csv').send(reportCsv(entries, { rounding }));
  });

  // ================= SPA =================
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    app.get('/', (req, res) =>
      res.status(503).type('html').send('<h1>UI not built</h1><p>Run <code>npm run build</code> first.</p>')
    );
  }

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
