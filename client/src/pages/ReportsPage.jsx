import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, Button, Select } from '../components.jsx';
import { fmtDuration, fmtHours, fmtMoney, localDay, addDays, weekStart } from '../lib/time.js';

// Validated dark-surface categorical palette (fixed order — never cycled).
const SERIES = ['#3987e5', '#199e70', '#c98500', '#008300', '#9085e9', '#e66767', '#d55181', '#d95926'];
const BAR = '#3987e5';
const INK_MUTED = '#898781';
const GRID = '#2c2c2a';

const PRESETS = [
  { id: 'week', label: 'This week' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'last30', label: 'Last 30 days' }
];

function presetRange(id) {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (id === 'week') return [weekStart(), endOfToday];
  if (id === 'last7') return [addDays(new Date(now.setHours(0, 0, 0, 0)), -6), endOfToday];
  if (id === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), endOfToday];
  return [addDays(new Date(now.setHours(0, 0, 0, 0)), -29), endOfToday];
}

function BarChart({ days }) {
  const [hover, setHover] = useState(null);
  if (!days.length) return null;
  const W = 640;
  const H = 180;
  const PAD = { l: 44, r: 8, t: 12, b: 22 };
  const max = Math.max(...days.map((d) => d.seconds), 3600);
  const bw = Math.min(36, ((W - PAD.l - PAD.r) / days.length) * 0.7);
  const step = (W - PAD.l - PAD.r) / days.length;
  const y = (v) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const ticks = [0, max / 2, max];
  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Tracked hours per day">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill={INK_MUTED}>
              {(t / 3600).toFixed(1)}h
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const x = PAD.l + step * i + (step - bw) / 2;
          const top = y(d.seconds);
          const h = Math.max(H - PAD.b - top, d.seconds > 0 ? 2 : 0);
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* hit target bigger than the mark */}
              <rect x={PAD.l + step * i} y={PAD.t} width={step} height={H - PAD.t - PAD.b} fill="transparent" />
              <rect
                x={x}
                y={top}
                width={bw}
                height={h}
                rx="4"
                fill={BAR}
                opacity={hover === null || hover === i ? 1 : 0.45}
              />
              {/* keep data-end rounded, baseline square */}
              {h > 4 && <rect x={x} y={H - PAD.b - Math.min(4, h)} width={bw} height={Math.min(4, h)} fill={BAR} opacity={hover === null || hover === i ? 1 : 0.45} />}
              <text x={PAD.l + step * i + step / 2} y={H - 8} textAnchor="middle" fontSize="9" fill={INK_MUTED}>
                {new Date(d.date + 'T12:00:00').toLocaleDateString([], { day: 'numeric', month: days.length > 10 ? undefined : 'short' })}
              </text>
              {hover === i && (
                <text x={PAD.l + step * i + step / 2} y={Math.max(top - 5, 10)} textAnchor="middle" fontSize="10" fill="#ffffff">
                  {fmtHours(d.seconds)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#383835" strokeWidth="1" />
      </svg>
    </div>
  );
}

function Donut({ groups, colorFor }) {
  const [hover, setHover] = useState(null);
  const total = groups.reduce((s, g) => s + g.seconds, 0);
  if (!total) return null;
  const R = 60;
  const r = 38;
  const CX = 80;
  const CY = 80;
  let angle = -Math.PI / 2;
  const arcs = groups.map((g, i) => {
    const frac = g.seconds / total;
    const a0 = angle;
    const a1 = (angle += frac * Math.PI * 2);
    // 2px surface gap between segments
    const gap = groups.length > 1 ? 0.02 : 0;
    const s0 = a0 + gap;
    const s1 = Math.max(a1 - gap, s0 + 0.005);
    const large = s1 - s0 > Math.PI ? 1 : 0;
    const p = (a, rad) => [CX + rad * Math.cos(a), CY + rad * Math.sin(a)];
    const [x0, y0] = p(s0, R);
    const [x1, y1] = p(s1, R);
    const [x2, y2] = p(s1, r);
    const [x3, y3] = p(s0, r);
    return {
      d: `M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`,
      g,
      color: colorFor(g, i)
    };
  });
  const active = hover !== null ? groups[hover] : null;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 160 160" className="h-36 w-36 shrink-0" role="img" aria-label="Time split">
        {arcs.map((a, i) => (
          <path
            key={a.g.key}
            d={a.d}
            fill={a.color}
            opacity={hover === null || hover === i ? 1 : 0.35}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        <text x={CX} y={CY - 3} textAnchor="middle" fontSize="13" fontWeight="600" fill="#ffffff">
          {active ? fmtHours(active.seconds) : fmtHours(total)}
        </text>
        <text x={CX} y={CY + 12} textAnchor="middle" fontSize="8.5" fill={INK_MUTED}>
          {active ? active.key.slice(0, 18) : 'total'}
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1 text-xs">
        {groups.slice(0, 8).map((g, i) => (
          <li
            key={g.key}
            className="flex cursor-default items-center gap-2"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorFor(g, i) }} />
            <span className="truncate text-zinc-300">{g.key}</span>
            <span className="ml-auto font-mono tabular-nums text-zinc-500">{fmtHours(g.seconds)}</span>
          </li>
        ))}
        {groups.length > 8 && <li className="text-zinc-600">+{groups.length - 8} more in table</li>}
      </ul>
    </div>
  );
}

export default function ReportsPage() {
  const [preset, setPreset] = useState('week');
  const [groupBy, setGroupBy] = useState('project');
  const [rounding, setRounding] = useState(0);
  const [report, setReport] = useState(null);

  const [from, to] = useMemo(() => presetRange(preset), [preset]);

  const qs = useCallback(
    () =>
      `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&group=${groupBy}&rounding=${rounding}`,
    [from, to, groupBy, rounding]
  );

  useEffect(() => {
    api.get(`/api/reports?${qs()}`).then(setReport);
  }, [qs]);

  const colorFor = (g, i) => (groupBy === 'project' && g.color ? g.color : SERIES[i % SERIES.length]);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Select value={preset} onChange={(e) => setPreset(e.target.value)}>
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </Select>
        <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value="project">By project</option>
          <option value="client">By client</option>
          <option value="tag">By tag</option>
          <option value="day">By day</option>
        </Select>
        <Select value={rounding} onChange={(e) => setRounding(Number(e.target.value))} title="Round each entry before summing">
          <option value={0}>No rounding</option>
          <option value={5}>Round to 5 min</option>
          <option value={15}>Round to 15 min</option>
        </Select>
        <div className="flex-1" />
        <a href={`/api/reports.csv?${qs()}`} download>
          <Button>
            <Download size={14} /> CSV
          </Button>
        </a>
        <Button onClick={() => window.print()}>
          <Printer size={14} /> Print
        </Button>
      </div>

      {report && (
        <>
          {/* stat tiles */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-4">
              <div className="text-xs text-zinc-500">Total time</div>
              <div className="mt-1 text-2xl font-semibold">{fmtDuration(report.totalSeconds)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-zinc-500">Billable</div>
              <div className="mt-1 text-2xl font-semibold text-emerald-400">{fmtMoney(report.totalAmount)}</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs text-zinc-500">Entries</div>
              <div className="mt-1 text-2xl font-semibold">{report.entryCount}</div>
            </Card>
          </div>

          {report.entryCount === 0 ? (
            <Card className="p-8 text-center text-sm text-zinc-500">No completed entries in this range.</Card>
          ) : (
            <>
              <Card className="p-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Hours per day</h3>
                <BarChart days={report.days} />
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Split by {report.groupBy}
                  </h3>
                  <Donut groups={report.groups} colorFor={colorFor} />
                </Card>

                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                        <th className="px-4 py-2 font-medium capitalize">{report.groupBy}</th>
                        <th className="px-4 py-2 text-right font-medium">Time</th>
                        <th className="px-4 py-2 text-right font-medium">Billable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/70">
                      {report.groups.map((g, i) => (
                        <tr key={g.key}>
                          <td className="flex items-center gap-2 px-4 py-2">
                            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorFor(g, i) }} />
                            {g.key}
                          </td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums">{fmtDuration(g.seconds)}</td>
                          <td className="px-4 py-2 text-right font-mono tabular-nums text-zinc-400">{fmtMoney(g.amount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-zinc-900 font-medium">
                        <td className="px-4 py-2">Total</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums">{fmtDuration(report.totalSeconds)}</td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-400">{fmtMoney(report.totalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {report.groupBy === 'tag' && (
                    <p className="px-4 pb-3 pt-1 text-[11px] text-zinc-600">
                      Entries with multiple tags appear in each tag row; the total counts each entry once.
                    </p>
                  )}
                </Card>
              </div>
              {rounding > 0 && (
                <p className="text-xs text-zinc-600">
                  Each entry rounded to the nearest {rounding} minutes before summing (report-level only — stored entries are untouched).
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
