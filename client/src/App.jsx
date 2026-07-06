import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, CalendarDays, BarChart3, FolderKanban, LogOut, Lock } from 'lucide-react';
import { api } from './lib/api.js';
import { Button, Input } from './components.jsx';
import TimerPage from './pages/TimerPage.jsx';
import TimesheetPage from './pages/TimesheetPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ManagePage from './pages/ManagePage.jsx';

const TABS = [
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'timesheet', label: 'Timesheet', icon: CalendarDays },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'manage', label: 'Projects', icon: FolderKanban }
];

function Login({ onDone }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/login', { password: pw });
      onDone();
    } catch (e2) {
      setErr(e2.message);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="w-full max-w-xs rounded-xl border border-zinc-800 bg-zinc-900/70 p-6"
      >
        <div className="mb-1 flex items-center gap-2 text-lg font-semibold">
          <Timer size={20} className="text-emerald-500" /> Timevault
        </div>
        <p className="mb-4 text-sm text-zinc-500">Your time. Your server. Your data.</p>
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-zinc-500" />
          <Input
            type="password"
            autoFocus
            placeholder="Admin password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="flex-1"
          />
        </div>
        {err && <p className="mt-2 text-xs text-red-400">{err}</p>}
        <Button variant="primary" className="mt-4 w-full justify-center" type="submit">
          Sign in
        </Button>
      </motion.form>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(null);
  const [tab, setTab] = useState('timer');

  const check = useCallback(async () => {
    try {
      const me = await api.get('/api/me');
      setAuthed(me.authed);
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  if (authed === null) return null;
  if (!authed) return <Login onDone={() => setAuthed(true)} />;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
      <header className="no-print sticky top-0 z-40 flex items-center gap-1 border-b border-zinc-800 bg-zinc-950/90 px-4 py-2 backdrop-blur">
        <div className="mr-4 flex items-center gap-2 font-semibold">
          <Timer size={18} className="text-emerald-500" /> Timevault
        </div>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              tab === id ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Icon size={15} /> {label}
            {tab === id && (
              <motion.span layoutId="tab-underline" className="absolute inset-x-2 -bottom-[9px] h-0.5 rounded bg-emerald-500" />
            )}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={async () => {
            await api.post('/api/logout');
            setAuthed(false);
          }}
          title="Log out"
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <LogOut size={15} />
        </button>
      </header>
      <main className="flex-1 p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {tab === 'timer' && <TimerPage />}
            {tab === 'timesheet' && <TimesheetPage />}
            {tab === 'reports' && <ReportsPage />}
            {tab === 'manage' && <ManagePage />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
