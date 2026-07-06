import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, Tag as TagIcon } from 'lucide-react';
import { api } from '../lib/api.js';
import { Card, Button, Input, Select, Modal, ProjectDot } from '../components.jsx';
import { fmtMoney } from '../lib/time.js';

const COLORS = ['#3987e5', '#199e70', '#c98500', '#9085e9', '#e66767', '#d55181', '#d95926', '#008300'];

function ProjectModal({ open, onClose, onSaved, project, clients }) {
  const [form, setForm] = useState({});
  useEffect(() => {
    if (open)
      setForm(
        project
          ? { ...project, billable: !!project.billable }
          : { name: '', client_id: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], billable: true, hourly_rate: 0 }
      );
  }, [open, project]);
  const [err, setErr] = useState('');
  const save = async () => {
    try {
      const body = { ...form, client_id: form.client_id || null };
      project ? await api.put(`/api/projects/${project.id}`, body) : await api.post('/api/projects', body);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <div className="space-y-3">
        <Input className="w-full" placeholder="Project name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select className="w-full" value={form.client_id || ''} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <div className="flex items-center gap-3">
          <label className="text-sm text-zinc-500">Color</label>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setForm({ ...form, color: c })}
                className={`h-6 w-6 rounded-full transition-transform ${form.color === c ? 'scale-110 ring-2 ring-white/70' : 'hover:scale-105'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={!!form.billable}
              onChange={(e) => setForm({ ...form, billable: e.target.checked })}
              className="accent-emerald-500"
            />
            Billable
          </label>
          {form.billable && (
            <span className="flex items-center gap-1 text-sm text-zinc-500">
              $
              <Input
                type="number"
                min="0"
                step="1"
                className="w-24"
                value={form.hourly_rate ?? 0}
                onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
              />
              / hour
            </span>
          )}
        </div>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function ManagePage() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [tags, setTags] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState({ open: false, project: null });
  const [newClient, setNewClient] = useState('');
  const [newTag, setNewTag] = useState('');

  const load = useCallback(async () => {
    const [p, c, t] = await Promise.all([api.get('/api/projects'), api.get('/api/clients'), api.get('/api/tags')]);
    setProjects(p);
    setClients(c);
    setTags(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = projects.filter((p) => showArchived || !p.archived);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Projects */}
      <Card className="lg:col-span-2">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold">Projects</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-zinc-500">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-emerald-500" />
              Show archived
            </label>
            <Button variant="primary" onClick={() => setModal({ open: true, project: null })}>
              <Plus size={14} /> Project
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-zinc-800/70">
          {visible.length === 0 && <li className="px-4 py-8 text-center text-sm text-zinc-500">No projects yet.</li>}
          {visible.map((p) => (
            <li key={p.id} className={`group flex items-center gap-3 px-4 py-2.5 text-sm ${p.archived ? 'opacity-50' : ''}`}>
              <ProjectDot color={p.color} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-zinc-500">
                  {p.client_name || 'No client'} · {p.billable ? `${fmtMoney(p.hourly_rate)}/hr` : 'non-billable'} · {p.entry_count} entries
                  {p.archived ? ' · archived' : ''}
                </div>
              </div>
              <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  title={p.archived ? 'Unarchive' : 'Archive'}
                  onClick={async () => {
                    await api.put(`/api/projects/${p.id}`, { archived: !p.archived });
                    load();
                  }}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  {p.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                </button>
                <button
                  title="Edit"
                  onClick={() => setModal({ open: true, project: p })}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                >
                  <Pencil size={13} />
                </button>
                <button
                  title="Delete"
                  onClick={async () => {
                    if (p.entry_count > 0 && !window.confirm(`Delete "${p.name}"? Its ${p.entry_count} entries keep their time but lose the project.`)) return;
                    await api.del(`/api/projects/${p.id}`);
                    load();
                  }}
                  className="rounded p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="space-y-4">
        {/* Clients */}
        <Card>
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-semibold">Clients</h2>
          </div>
          <div className="p-3">
            <form
              className="mb-2 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newClient.trim()) return;
                await api.post('/api/clients', { name: newClient.trim() });
                setNewClient('');
                load();
              }}
            >
              <Input className="flex-1" placeholder="New client…" value={newClient} onChange={(e) => setNewClient(e.target.value)} />
              <Button type="submit"><Plus size={14} /></Button>
            </form>
            <ul className="space-y-1">
              {clients.map((c) => (
                <li key={c.id} className="group flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-900">
                  {c.name}
                  <button
                    onClick={async () => {
                      await api.del(`/api/clients/${c.id}`);
                      load();
                    }}
                    className="rounded p-1 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        {/* Tags */}
        <Card>
          <div className="border-b border-zinc-800 px-4 py-3">
            <h2 className="text-sm font-semibold">Tags</h2>
          </div>
          <div className="p-3">
            <form
              className="mb-2 flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!newTag.trim()) return;
                await api.post('/api/tags', { name: newTag.trim() });
                setNewTag('');
                load();
              }}
            >
              <Input className="flex-1" placeholder="New tag…" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
              <Button type="submit"><Plus size={14} /></Button>
            </form>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t.id} className="group inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                  <TagIcon size={10} /> {t.name}
                  <button
                    onClick={async () => {
                      await api.del(`/api/tags/${t.id}`);
                      load();
                    }}
                    className="text-zinc-600 hover:text-red-400"
                  >
                    <Trash2 size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <ProjectModal open={modal.open} project={modal.project} clients={clients} onClose={() => setModal({ open: false, project: null })} onSaved={load} />
    </div>
  );
}
