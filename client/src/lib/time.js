export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function fmtHours(sec) {
  return (sec / 3600).toFixed(2) + 'h';
}

export function fmtMoney(n) {
  return '$' + Number(n || 0).toFixed(2);
}

export function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(iso) {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export function localDay(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday of the week containing `date`. */
export function weekStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

/** Parse "1:30", "1.5", "90m", "1h30m" → seconds; null when unparseable. */
export function parseDuration(str) {
  const s = String(str || '').trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return (+m[1]) * 3600 + (+m[2]) * 60 + (+(m[3] || 0));
  m = s.match(/^(?:(\d+(?:\.\d+)?)h)?\s*(?:(\d+)m)?$/);
  if (m && (m[1] || m[2])) return Math.round((+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Math.round(+m[1] * 3600);
  return null;
}
