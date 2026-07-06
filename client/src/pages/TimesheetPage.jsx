import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, Button, ProjectDot, OverlapBadge } from '../components.jsx';
import { fmtDuration, localDay, weekStart, addDays, parseDuration } from '../lib/time.js';
import EntryModal from './EntryModal.jsx';

/** Inline-editable duration cell: click, type "1:30" / "1.5" / "90m", Enter to save. */
function InlineDuration({ entry, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  if (!entry.stop) return <span className="font-mono text-xs text-emerald-400">running</span>;
  if (!editing) {
    return (
      <button
        className="rounded font-mono text-xs tabular-nums text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 px-1"
        title="Click to edit duration"
        onClick={() => {
          setVal(fmtDuration(entry.duration).replace(/:\d{2}$/, ''));
          setEditing(true);
        }}
      >
        {fmtDuration(entry.duration)}
      </button>
    );
  }
  const save = async () => {
    const sec = parseDuration(val);
    if (sec) await api.put(`/api/entries/${entry.id}`, { duration_seconds: sec });
    setEditing(false);
    onSaved();
  };
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-16 rounded border border-emerald-600 bg-zinc-900 px-1 font-mono text-xs text-zinc-100 outline-none"
    />
  );
}

/** Inline-editable description. */
function InlineDescription({ entry, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');
  if (!editing) {
    return (
      <button
        className={`block w-full truncate rounded px-1 text-left text-xs hover:bg-zinc-800 ${entry.description ? 'text-zinc-200' : 'italic text-zinc-500'}`}
        title="Click to edit"
        onClick={() => {
          setVal(entry.description);
          setEditing(true);
        }}
      >
        {entry.description || 'No description'}
      </button>
    );
  }
  const save = async () => {
    await api.put(`/api/entries/${entry.id}`, { description: val });
    setEditing(false);
    onSaved();
  };
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') setEditing(false);
      }}
      className="w-full rounded border border-emerald-600 bg-zinc-900 px-1 text-xs text-zinc-100 outline-none"
    />
  );
}

export default function TimesheetPage() {
  const [anchor, setAnchor] = useState(() => weekStart());
  const [entries, setEntries] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [modal, setModal] = useState({ open: false, entry: null, defaultStart: null });

  const refreshTags = useCallback(async () => setTags(await api.get('/api/tags')), []);

  const load = useCallback(async () => {
    const from = anchor.toISOString();
    const to = addDays(anchor, 7).toISOString();
    setEntries(await api.get(`/api/entries?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
  }, [anchor]);

  useEffect(() => {
    load();
    api.get('/api/projects').then(setProjects);
    refreshTags();
  }, [load, refreshTags]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  const weekTotal = entries.filter((e) => e.stop).reduce((s, e) => s + e.duration, 0);
  const fmtRange = `${anchor.toLocaleDateString([], { month: 'short', day: 'numeric' })} – ${addDays(anchor, 6).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={() => setAnchor(addDays(anchor, -7))}>
          <ChevronLeft size={15} />
        </Button>
        <span className="min-w-36 text-center text-sm font-medium">{fmtRange}</span>
        <Button variant="ghost" onClick={() => setAnchor(addDays(anchor, 7))}>
          <ChevronRight size={15} />
        </Button>
        <Button variant="ghost" onClick={() => setAnchor(weekStart())}>
          This week
        </Button>
        <div className="flex-1" />
        <span className="text-sm text-zinc-400">
          Week total: <span className="font-mono tabular-nums text-zinc-100">{fmtDuration(weekTotal)}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7 lg:gap-1.5">
        {days.map((d) => {
          const dayKey = localDay(d.toISOString());
          const items = entries.filter((e) => localDay(e.start) === dayKey).sort((a, b) => a.start.localeCompare(b.start));
          const total = items.filter((e) => e.stop).reduce((s, e) => s + e.duration, 0);
          const isToday = dayKey === localDay(new Date().toISOString());
          return (
            <Card key={dayKey} className={`flex min-h-44 flex-col p-2 ${isToday ? 'ring-1 ring-emerald-600/50' : ''}`}>
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className={`text-[11px] font-semibold uppercase ${isToday ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {d.toLocaleDateString([], { weekday: 'short' })} {d.getDate()}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-zinc-500">{total ? fmtDuration(total) : ''}</span>
              </div>
              <div className="flex-1 space-y-1">
                {items.map((e) => (
                  <div key={e.id} className="group rounded-lg border border-zinc-800 bg-zinc-900 p-1.5">
                    <InlineDescription entry={e} onSaved={load} />
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="flex min-w-0 items-center gap-1 text-[10px] text-zinc-500">
                        {e.project_name && (
                          <>
                            <ProjectDot color={e.project_color} />
                            <span className="truncate">{e.project_name}</span>
                          </>
                        )}
                        {e.overlap && <OverlapBadge />}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <InlineDuration entry={e} onSaved={load} />
                        <button
                          onClick={() => setModal({ open: true, entry: e, defaultStart: null })}
                          className="rounded p-0.5 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-200 group-hover:opacity-100"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={async () => {
                            await api.del(`/api/entries/${e.id}`);
                            load();
                          }}
                          className="rounded p-0.5 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  const start = new Date(d);
                  start.setHours(9, 0, 0, 0);
                  setModal({ open: true, entry: null, defaultStart: start });
                }}
                className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-800 py-1 text-[11px] text-zinc-600 transition-colors hover:border-emerald-700 hover:text-emerald-400"
              >
                <Plus size={11} /> Add
              </button>
            </Card>
          );
        })}
      </div>

      <EntryModal
        open={modal.open}
        entry={modal.entry}
        defaultStart={modal.defaultStart}
        onClose={() => setModal({ open: false, entry: null, defaultStart: null })}
        onSaved={load}
        projects={projects}
        tags={tags}
        refreshTags={refreshTags}
      />
    </div>
  );
}
