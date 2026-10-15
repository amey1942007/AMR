'use client';
import { useEffect, useRef } from 'react';
import type { ConsoleLogLine } from '@/lib/telemetry/protocol';

const LEVEL: Record<string, string> = {
  error: 'text-[var(--danger)]',
  warn: 'text-amber-300',
  run: 'text-cyan-300',
  tool: 'text-[#c792ea]',
  info: 'text-white/80',
};

export function ConsolePanel({ logs }: { logs: ConsoleLogLine[] }) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div
      ref={boxRef}
      className="h-[220px] overflow-y-auto rounded-[var(--radius-chip)] border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
    >
      {logs.length === 0 && (
        <p className="text-muted">Console — data & events from the Pi bridge…</p>
      )}
      {logs.map((ln, i) => (
        <div key={`${ln.ts ?? i}-${i}`} className={`whitespace-pre-wrap break-words ${LEVEL[ln.level] || LEVEL.info}`}>
          <span className="mr-2 text-white/35">{ln.time}</span>
          {ln.text}
        </div>
      ))}
    </div>
  );
}
