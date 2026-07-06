import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Tag, ChevronDown, AlertTriangle } from 'lucide-react';

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900/60 ${className}`}>{children}</div>
  );
}

export function Button({ children, variant = 'default', className = '', ...props }) {
  const styles = {
    default: 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700',
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger: 'bg-red-600/90 hover:bg-red-500 text-white',
    ghost: 'hover:bg-zinc-800 text-zinc-300'
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      className={`rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-emerald-500 ${props.className || ''}`}
    />
  );
}

export function Select({ children, ...props }) {
  return (
    <div className="relative inline-block">
      <select
        {...props}
        className={`appearance-none rounded-lg border border-zinc-700 bg-zinc-900 py-1.5 pl-3 pr-8 text-sm text-zinc-100 outline-none focus:border-emerald-500 ${props.className || ''}`}
      >
        {children}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            className={`w-full ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl`}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">{title}</h3>
              <button onClick={onClose} className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ProjectDot({ color }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color || '#52525b' }} />;
}

export function OverlapBadge() {
  return (
    <span
      title="This entry overlaps another entry"
      className="inline-flex items-center gap-1 rounded-full border border-amber-600/50 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400"
    >
      <AlertTriangle size={11} /> overlap
    </span>
  );
}

export function TagPills({ tags }) {
  if (!tags?.length) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
          <Tag size={9} /> {t}
        </span>
      ))}
    </span>
  );
}

/** Multi-select tag picker with inline create. */
export function TagPicker({ allTags, selected, onChange, onCreate }) {
  const [input, setInput] = useState('');
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {allTags.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => toggle(t.id)}
          className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
            selected.includes(t.id)
              ? 'bg-emerald-600/20 text-emerald-400 ring-1 ring-emerald-600/50'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {t.name}
        </button>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter' && input.trim()) {
            e.preventDefault();
            const tag = await onCreate(input.trim());
            if (tag && !selected.includes(tag.id)) onChange([...selected, tag.id]);
            setInput('');
          }
        }}
        placeholder="+ tag"
        className="w-20 rounded-full border border-dashed border-zinc-700 bg-transparent px-2.5 py-1 text-xs text-zinc-300 outline-none placeholder-zinc-600 focus:border-emerald-600"
      />
    </div>
  );
}
