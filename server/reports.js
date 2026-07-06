// Report math: durations, entry-level rounding, grouping, billable amounts, CSV.
// Kept dependency-free so the smoke test can exercise it via the HTTP API only.

/** Raw duration of a completed entry, in seconds. Running entries count up to `now`. */
function durationSec(entry, now = Date.now()) {
  const start = Date.parse(entry.start);
  const stop = entry.stop ? Date.parse(entry.stop) : now;
  return Math.max(0, Math.round((stop - start) / 1000));
}

/** Round a duration to the nearest N minutes (N = 0 disables rounding). */
function roundSec(sec, roundingMinutes) {
  const step = Number(roundingMinutes) * 60;
  if (!step) return sec;
  return Math.round(sec / step) * step;
}

/** Local calendar date (YYYY-MM-DD) of an ISO timestamp. */
function localDay(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** True when two entries overlap in time (open entries extend to `now`). */
function entriesOverlap(a, b, now = Date.now()) {
  const aStart = Date.parse(a.start);
  const aStop = a.stop ? Date.parse(a.stop) : now;
  const bStart = Date.parse(b.start);
  const bStop = b.stop ? Date.parse(b.stop) : now;
  return aStart < bStop && aStop > bStart;
}

/** Mark each entry with `overlap: true` when it collides with any sibling. */
function flagOverlaps(entries, now = Date.now()) {
  const sorted = [...entries].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const flagged = new Set();
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];
      if (Date.parse(b.start) >= (a.stop ? Date.parse(a.stop) : now)) break;
      if (entriesOverlap(a, b, now)) {
        flagged.add(a.id);
        flagged.add(b.id);
      }
    }
  }
  return entries.map((e) => ({ ...e, overlap: flagged.has(e.id) }));
}

/**
 * Build a report over completed entries.
 * entries: rows joined with project { project_name, client_name, hourly_rate, billable, tags: [names] }
 * groupBy: 'project' | 'client' | 'tag' | 'day'
 * rounding: minutes (0 | 5 | 15) applied per entry before summing.
 */
function buildReport(entries, { groupBy = 'project', rounding = 0 } = {}) {
  const completed = entries.filter((e) => e.stop);

  const perEntry = completed.map((e) => {
    const sec = roundSec(durationSec(e), rounding);
    const rate = e.billable && e.hourly_rate > 0 ? e.hourly_rate : 0;
    const amount = +((sec / 3600) * rate).toFixed(2);
    return { ...e, rounded_sec: sec, amount };
  });

  const groups = new Map();
  const add = (key, meta, e) => {
    if (!groups.has(key)) groups.set(key, { key, ...meta, seconds: 0, amount: 0, entries: 0 });
    const g = groups.get(key);
    g.seconds += e.rounded_sec;
    g.amount = +(g.amount + e.amount).toFixed(2);
    g.entries += 1;
  };

  for (const e of perEntry) {
    if (groupBy === 'project') {
      add(e.project_name || 'No project', { color: e.project_color || null }, e);
    } else if (groupBy === 'client') {
      add(e.client_name || 'No client', {}, e);
    } else if (groupBy === 'day') {
      add(localDay(e.start), {}, e);
    } else if (groupBy === 'tag') {
      const tags = e.tags && e.tags.length ? e.tags : ['No tag'];
      for (const t of tags) add(t, {}, e);
    }
  }

  const list = [...groups.values()].sort((a, b) =>
    groupBy === 'day' ? a.key.localeCompare(b.key) : b.seconds - a.seconds
  );

  // Totals sum entries once (tag grouping can double-count an entry across groups).
  const totalSeconds = perEntry.reduce((s, e) => s + e.rounded_sec, 0);
  const totalAmount = +perEntry.reduce((s, e) => s + e.amount, 0).toFixed(2);

  // Per-day series for the bar chart, independent of groupBy.
  const byDay = new Map();
  for (const e of perEntry) {
    const d = localDay(e.start);
    byDay.set(d, (byDay.get(d) || 0) + e.rounded_sec);
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, seconds]) => ({ date, seconds }));

  return { groups: list, totalSeconds, totalAmount, days, entryCount: perEntry.length };
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function reportCsv(entries, { rounding = 0 } = {}) {
  const completed = entries.filter((e) => e.stop);
  const header = 'description,project,client,tags,start,stop,duration_seconds,duration_hours,billable_amount';
  const lines = completed.map((e) => {
    const sec = roundSec(durationSec(e), rounding);
    const rate = e.billable && e.hourly_rate > 0 ? e.hourly_rate : 0;
    const amount = ((sec / 3600) * rate).toFixed(2);
    return [
      csvEscape(e.description),
      csvEscape(e.project_name || ''),
      csvEscape(e.client_name || ''),
      csvEscape((e.tags || []).join('; ')),
      e.start,
      e.stop,
      sec,
      (sec / 3600).toFixed(2),
      amount
    ].join(',');
  });
  return [header, ...lines].join('\n') + '\n';
}

module.exports = { durationSec, roundSec, localDay, flagOverlaps, buildReport, reportCsv };
