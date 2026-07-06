import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, Trash2, RotateCcw, Pencil, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, Button, Input, Select, TagPicker, ProjectDot, TagPills, OverlapBadge } from '../components.jsx';
import { fmtDuration, fmtTime, fmtDay, localDay } from '../lib/time.js';
import EntryModal from './EntryModal.jsx';

export default function TimerPage() {
  const [running, setRunning] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tagIds, setTagIds] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tags, setTags] = useState([]);
  const [entries, setEntries] = useState([]);
  const [modal, setModal] = useState({ open: false, entry: null });
  const tick = useRef(null);

  const refreshTags = useCallback(async () => setTags(await api.get('/api/tags')), []);
  const refreshEntries = useCallback(async () => setEntries(await api.get('/api/entries')), []);

  const refreshStatus = useCallback(async () => {
    const s = await api.get('/api/timer/status');
    setRunning(s.running);
    setElapsed(s.elapsed);
    if (s.running) {
      setDescription(s.running.description);
      setProjectId(s.running.project_id || '');
      setTagIds((s.running.tag_objects || []).map((t) => t.id));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    refreshEntries();
    api.get('/api/projects').then(setProjects);
    refreshTags();
  }, [refreshStatus, refreshEntries, refreshTags]);

  // local ticking while running (server remains source of truth on reload)
  useEffect(() => {
    if (running) {
      tick.current = setInterval(() => {
        setElapsed(Math.max(0, Math.round((Date.now() - Date.parse(running.start)) / 1000)));
      }, 1000);
      return () => clearInterval(tick.current);
    }
  }, [running]);

  const start = async () => {
    const e = await api.post('/api/timer/start', { description, project_id: projectId || null, tag_ids: tagIds });
    setRunning(e);
    setElapsed(0);
    refreshEntries();
  };

  const stop = async () => {
    await api.post('/api/timer/stop');
    setRunning(null);
    setElapsed(0);
    setDescription('');
    setProjectId('');
    setTagIds([]);
    refreshEntries();
  };

  const discard = async () => {
    await api.post('/api/timer/discard');
    setRunning(null);
    setElapsed(0);
    refreshEntries();
  };

  const continueEntry = async (id) => {
    const e = await api.post(`/api/timer/continue/${id}`);
    setRunning(e);
    setElapsed(0);
    setDescription(e.description);
    setProjectId(e.project_id || '');
    setTagIds((e.tag_objects || []).map((t) => t.id));
    refreshEntries();
  };

  const createTag = async (name) => {
    const t = await api.post('/api/tags', { name });
    await refreshTags();
    return t;
  };

  const remove = async (id) => {
    await api.del(`/api/entries/${id}`);
    refreshEntries();
  };

  // group recent entries by day
  const byDay = [];
  for (const e of entries) {
    const day = localDay(e.start);
    let g = byDay.find((x) => x.day === day);
    if (!g) byDay.push((g = { day, label: fmtDay(e.start), items: [], total: 0 }));
    g.items.push(e);
    if (e.stop) g.total += e.duration;
  }

  return (
    <div className="space-y-4">
      {/* Timer bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-48 flex-1"
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !running && start()}
            disabled={!!running}
          />
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!!running}>
            <option value="">No project</option>
            {projects.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.client_name ? ` · ${p.client_name}` : ''}
              </option>
            ))}
          </Select>
          <div className={`w-28 text-center font-mono text-xl tabular-nums ${running ? 'text-emerald-400' : 'text-zinc-600'}`}>
            {fmtDuration(elapsed)}
          </div>
          {running ? (
            <>
              <Button variant="danger" onClick={stop}>
                <Square size={14} /> Stop
              </Button>
              <Button variant="ghost" onClick={discard} title="Discard the running entry">
                <Trash2 size={14} />
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={start}>
              <Play size={14} /> Start
            </Button>
          )}
        </div>
        <div className="mt-3">
          <TagPicker allTags={tags} selected={tagIds} onChange={(v) => !running && setTagIds(v)} onCreate={createTag} />
        </div>
        {running && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-zinc-500">
            Timer runs on the server — reload, close the tab, come back. Still counting.
          </motion.p>
        )}
      </Card>

      {/* Recent entries */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-400">Recent entries</h2>
        <Button variant="ghost" onClick={() => setModal({ open: true, entry: null })}>
          <Plus size={14} /> Manual entry
        </Button>
      </div>

      {byDay.length === 0 && (
        <Card className="p-8 text-center text-sm text-zinc-500">
          No entries yet. Hit <span className="text-emerald-400">Start</span> and get to work.
        </Card>
      )}

      {byDay.map((g) => (
        <Card key={g.day} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-zinc-400">
            <span>{g.label}</span>
            <span className="font-mono tabular-nums">{fmtDuration(g.total)}</span>
          </div>
          <ul className="divide-y divide-zinc-800/70">
            {g.items.map((e) => (
              <li key={e.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate ${e.description ? '' : 'italic text-zinc-500'}`}>
                      {e.description || 'No description'}
                    </span>
                    {e.overlap && <OverlapBadge />}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                    {e.project_name && (
                      <span className="flex items-center gap-1.5">
                        <ProjectDot color={e.project_color} /> {e.project_name}
                        {e.client_name ? ` · ${e.client_name}` : ''}
                      </span>
                    )}
                    <TagPills tags={e.tags} />
                  </div>
                </div>
                <span className="text-xs text-zinc-500">
                  {fmtTime(e.start)} – {e.stop ? fmtTime(e.stop) : 'now'}
                </span>
                <span className={`w-20 text-right font-mono text-xs tabular-nums ${e.stop ? 'text-zinc-300' : 'text-emerald-400'}`}>
                  {e.stop ? fmtDuration(e.duration) : 'running'}
                </span>
                <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button title="Continue" onClick={() => continueEntry(e.id)} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-emerald-400">
                    <RotateCcw size={13} />
                  </button>
                  <button title="Edit" onClick={() => setModal({ open: true, entry: e })} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
                    <Pencil size={13} />
                  </button>
                  <button title="Delete" onClick={() => remove(e.id)} className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400">
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}

      <EntryModal
        open={modal.open}
        entry={modal.entry}
        onClose={() => setModal({ open: false, entry: null })}
        onSaved={refreshEntries}
        projects={projects}
        tags={tags}
        refreshTags={refreshTags}
      />
    </div>
  );
}
