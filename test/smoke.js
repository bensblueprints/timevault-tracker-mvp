// Timevault smoke test — exercises the real HTTP API end-to-end against a temp DB.
// Run: npm test
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'timevault-smoke-'));
process.env.ADMIN_PASSWORD = 'smoke-pass';

const { createApp } = require('../server/app.js');

const app = createApp({ dataDir, adminPassword: 'smoke-pass' });
const server = app.listen(0, '127.0.0.1');

let cookie = '';
async function call(method, url, body) {
  const base = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(base + url, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), cookie },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
function ok(name, cond) {
  assert(cond, `FAIL: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

(async () => {
  console.log('Timevault smoke test');
  await new Promise((resolve) => server.once('listening', resolve));

  // --- auth ---
  let r = await call('GET', '/api/clients');
  ok('unauthenticated request is rejected', r.status === 401);
  r = await call('POST', '/api/login', { password: 'wrong' });
  ok('wrong password rejected', r.status === 401);
  r = await call('POST', '/api/login', { password: 'smoke-pass' });
  ok('login succeeds', r.status === 200);

  // --- client / project / tags ---
  const client = (await call('POST', '/api/clients', { name: 'Acme Corp' })).data;
  ok('client created', client.id > 0 && client.name === 'Acme Corp');

  const project = (await call('POST', '/api/projects', {
    name: 'Website Redesign', client_id: client.id, color: '#3987e5', billable: true, hourly_rate: 90
  })).data;
  ok('project created at $90/hr', project.id > 0 && project.hourly_rate === 90);

  const tagDev = (await call('POST', '/api/tags', { name: 'dev' })).data;
  const tagUx = (await call('POST', '/api/tags', { name: 'ux' })).data;
  ok('tags created', tagDev.id > 0 && tagUx.id > 0);

  // --- timer ---
  r = await call('POST', '/api/timer/start', {
    description: 'Homepage hero', project_id: project.id, tag_ids: [tagDev.id]
  });
  ok('timer started', r.status === 201 && r.data.stop === null);

  r = await call('GET', '/api/timer/status');
  ok('status endpoint shows running timer', r.data.running && r.data.running.description === 'Homepage hero');
  ok('running timer carries project + tags', r.data.running.project_id === project.id && r.data.running.tags.includes('dev'));

  await sleep(2100);
  r = await call('POST', '/api/timer/stop');
  ok('timer stopped', r.status === 200 && r.data.stop !== null);
  ok('stopped entry has ~2s duration', r.data.duration >= 2 && r.data.duration <= 10);
  const timerEntryId = r.data.id;

  r = await call('GET', '/api/timer/status');
  ok('status shows no running timer after stop', r.data.running === null);

  r = await call('GET', '/api/entries');
  ok('stopped entry exists in entries list', r.data.some((e) => e.id === timerEntryId && e.stop));

  // --- continue previous ---
  r = await call('POST', `/api/timer/continue/${timerEntryId}`);
  ok('continue starts a new timer with same fields', r.status === 201 && r.data.description === 'Homepage hero' && r.data.id !== timerEntryId);
  r = await call('POST', '/api/timer/discard');
  ok('discard removes the running entry', r.status === 200);

  // --- manual entry: 1.5h on a fixed, isolated day ---
  const start = new Date('2026-07-01T09:00:00.000Z');
  const manual = (await call('POST', '/api/entries', {
    description: 'Design review', project_id: project.id, tag_ids: [tagDev.id, tagUx.id],
    start: start.toISOString(), duration_seconds: 5400
  })).data;
  ok('manual 1.5h entry created', manual.duration === 5400);
  ok('non-conflicting manual entry not flagged as overlap', manual.overlap === false);

  // --- report over that day: exact math ---
  const from = '2026-07-01T00:00:00.000Z';
  const to = '2026-07-01T23:59:59.000Z';
  r = await call('GET', `/api/reports?from=${from}&to=${to}&group=project&rounding=0`);
  ok('report total duration is exactly 1.5h', r.data.totalSeconds === 5400);
  ok('report billable is exactly $135.00 (1.5h × $90)', r.data.totalAmount === 135);
  const pg = r.data.groups.find((g) => g.key === 'Website Redesign');
  ok('project group carries exact duration + amount', pg && pg.seconds === 5400 && pg.amount === 135);

  // grouping by client
  r = await call('GET', `/api/reports?from=${from}&to=${to}&group=client&rounding=0`);
  const cg = r.data.groups.find((g) => g.key === 'Acme Corp');
  ok('client grouping math exact', cg && cg.seconds === 5400 && cg.amount === 135);

  // grouping by tag: entry appears under both tags, total still counts it once
  r = await call('GET', `/api/reports?from=${from}&to=${to}&group=tag&rounding=0`);
  const tDev = r.data.groups.find((g) => g.key === 'dev');
  const tUx = r.data.groups.find((g) => g.key === 'ux');
  ok('tag grouping shows entry under each tag', tDev?.seconds === 5400 && tUx?.seconds === 5400);
  ok('tag report total counts each entry once', r.data.totalSeconds === 5400);

  // grouping by day
  r = await call('GET', `/api/reports?from=${from}&to=${to}&group=day&rounding=0`);
  ok('day grouping sums the day exactly', r.data.groups.length === 1 && r.data.groups[0].seconds === 5400);

  // --- rounding: a 1h37m entry on another isolated day ---
  await call('POST', '/api/entries', {
    description: 'Odd-length task', project_id: project.id,
    start: '2026-07-02T09:00:00.000Z', duration_seconds: 5820 // 1h37m
  });
  const f2 = '2026-07-02T00:00:00.000Z';
  const t2 = '2026-07-02T23:59:59.000Z';
  const raw = (await call('GET', `/api/reports?from=${f2}&to=${t2}&rounding=0`)).data;
  const r15 = (await call('GET', `/api/reports?from=${f2}&to=${t2}&rounding=15`)).data;
  const r5 = (await call('GET', `/api/reports?from=${f2}&to=${t2}&rounding=5`)).data;
  ok('unrounded report shows 5820s', raw.totalSeconds === 5820);
  ok('15-min rounding changes duration to 5400s (1h30m nearest)', r15.totalSeconds === 5400);
  ok('5-min rounding gives 5700s (1h35m nearest)', r5.totalSeconds === 5700);
  ok('rounding changes billable too ($145.50 → $135.00)', raw.totalAmount === 145.5 && r15.totalAmount === 135);

  // --- overlap detection ---
  const conflicting = (await call('POST', '/api/entries', {
    description: 'Double-booked call', start: '2026-07-01T10:00:00.000Z', duration_seconds: 3600
  })).data; // 10:00–11:00 overlaps 09:00–10:30 manual entry
  ok('conflicting manual entry flagged with overlap warn', conflicting.overlap === true);
  r = await call('GET', `/api/entries?from=${from}&to=${to}`);
  const both = r.data.filter((e) => e.overlap);
  ok('both colliding entries carry the overlap badge', both.length === 2);

  // --- CSV export contains both rows ---
  r = await call('GET', `/api/reports.csv?from=${from}&to=${to}&rounding=0`);
  ok('CSV has header', r.data.startsWith('description,project,client,tags,start,stop,duration_seconds'));
  ok('CSV contains manual entry row with amount', r.data.includes('Design review') && r.data.includes('135.00'));
  ok('CSV contains conflicting entry row', r.data.includes('Double-booked call'));
  ok('CSV row count = header + 2 entries', r.data.trim().split('\n').length === 3);

  // --- archive project ---
  r = await call('PUT', `/api/projects/${project.id}`, { archived: true });
  ok('project archived', r.data.archived === 1);
  r = await call('GET', '/api/projects');
  ok('archived project still listed (flagged)', r.data.find((p) => p.id === project.id)?.archived === 1);

  console.log(`\nAll ${passed} assertions passed.`);
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error('\n' + (e.message || e));
  server.close();
  process.exit(1);
});
