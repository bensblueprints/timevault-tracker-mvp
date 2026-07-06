import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Modal, Button, Input, Select, TagPicker } from '../components.jsx';
import { parseDuration, fmtHours } from '../lib/time.js';

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Create/edit a time entry. Two duration modes: explicit start+end, or start+duration.
 * props: open, onClose, onSaved, entry (null = create), projects, tags, refreshTags, defaultStart
 */
export default function EntryModal({ open, onClose, onSaved, entry, projects, tags, refreshTags, defaultStart }) {
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [tagIds, setTagIds] = useState([]);
  const [start, setStart] = useState('');
  const [mode, setMode] = useState('range'); // range | duration
  const [stop, setStop] = useState('');
  const [duration, setDuration] = useState('');
  const [err, setErr] = useState('');
  const [overlapWarn, setOverlapWarn] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr('');
    setOverlapWarn(false);
    if (entry) {
      setDescription(entry.description || '');
      setProjectId(entry.project_id || '');
      setTagIds((entry.tag_objects || []).map((t) => t.id));
      setStart(toLocalInput(entry.start));
      setStop(toLocalInput(entry.stop));
      setMode('range');
      setDuration('');
    } else {
      const base = defaultStart || new Date();
      setDescription('');
      setProjectId('');
      setTagIds([]);
      setStart(toLocalInput(base.toISOString()));
      setStop('');
      setDuration('1:00');
      setMode('duration');
    }
  }, [open, entry, defaultStart]);

  const createTag = async (name) => {
    const t = await api.post('/api/tags', { name });
    await refreshTags();
    return t;
  };

  const save = async () => {
    setErr('');
    try {
      const body = {
        description,
        project_id: projectId || null,
        tag_ids: tagIds,
        start: new Date(start).toISOString()
      };
      if (mode === 'duration') {
        const sec = parseDuration(duration);
        if (!sec) return setErr('Duration like 1:30, 1.5 or 90m');
        body.duration_seconds = sec;
      } else {
        if (!stop) return setErr('End time required');
        body.stop = new Date(stop).toISOString();
      }
      const saved = entry ? await api.put(`/api/entries/${entry.id}`, body) : await api.post('/api/entries', body);
      if (saved.overlap) setOverlapWarn(true);
      onSaved();
      if (!saved.overlap) onClose();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Edit entry' : 'Add manual entry'}>
      <div className="space-y-3">
        <Input
          className="w-full"
          placeholder="What did you work on?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Select className="w-full" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">No project</option>
          {projects.filter((p) => !p.archived || p.id === entry?.project_id).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.client_name ? ` · ${p.client_name}` : ''}
            </option>
          ))}
        </Select>
        <TagPicker allTags={tags} selected={tagIds} onChange={setTagIds} onCreate={createTag} />

        <div className="flex items-center gap-2 text-sm">
          <label className="w-12 text-zinc-500">Start</label>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="flex-1" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <label className="w-12 text-zinc-500">
            <button
              type="button"
              className="underline decoration-dotted underline-offset-2 hover:text-zinc-300"
              onClick={() => setMode(mode === 'range' ? 'duration' : 'range')}
              title="Toggle between end time and duration"
            >
              {mode === 'range' ? 'End' : 'For'}
            </button>
          </label>
          {mode === 'range' ? (
            <Input type="datetime-local" value={stop} onChange={(e) => setStop(e.target.value)} className="flex-1" />
          ) : (
            <Input placeholder="1:30 or 1.5 or 90m" value={duration} onChange={(e) => setDuration(e.target.value)} className="flex-1" />
          )}
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}
        {overlapWarn && (
          <p className="rounded-lg border border-amber-600/40 bg-amber-500/10 p-2 text-xs text-amber-400">
            Saved — but this entry overlaps another entry. Check your timesheet.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          {overlapWarn ? (
            <Button onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button variant="primary" onClick={save}>Save</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
