'use client';
import type { BotTelemetry } from '@/lib/telemetry/protocol';
import type { LinkStatus as HookStatus } from '@/lib/telemetry/useBotTelemetry';

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block size-2 rounded-full ${ok ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`}
      aria-hidden
    />
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-1.5 text-[length:var(--text-small)]">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-white/90 tabular-nums">{value}</span>
    </div>
  );
}

export function StatusBoard({
  frame,
  status,
  lagMs,
}: {
  frame: BotTelemetry | null;
  status: HookStatus;
  lagMs: number;
}) {
  const sys = frame?.sys;
  const pose = frame?.pose;
  const rates = frame?.rates ?? {};
  const nodes = frame?.nodes ?? {};
  const nodeEntries = Object.entries(nodes).slice(0, 16);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <p className="eyebrow text-muted mb-3">Vitals</p>
        <Row label="Link" value={status.toUpperCase()} />
        <Row label="Lag" value={`${Math.round(lagMs)} ms`} />
        <Row label="CPU" value={sys?.cpu != null ? `${sys.cpu}%` : '—'} />
        <Row label="Temp" value={sys?.temp != null ? `${sys.temp}°C` : '—'} />
        <Row
          label="RAM"
          value={sys?.mem ? `${sys.mem[0].toFixed(1)} / ${sys.mem[1].toFixed(1)} GB` : '—'}
        />
        <Row label="Uptime" value={sys?.up ?? '—'} />
        <Row
          label="Pose"
          value={pose ? `${pose[0].toFixed(2)}, ${pose[1].toFixed(2)}, ${pose[2].toFixed(2)}` : '—'}
        />
        <Row
          label="Vel"
          value={frame ? `${frame.vel[0].toFixed(2)} m/s · ${frame.vel[1].toFixed(2)} rad/s` : '—'}
        />
      </section>
      <section>
        <p className="eyebrow text-muted mb-3">Topics</p>
        {Object.keys(rates).length === 0 && <p className="text-muted text-[length:var(--text-small)]">No rate data</p>}
        {Object.entries(rates).map(([topic, r]) => {
          const hz = typeof r === 'number' ? r : r?.hz;
          return <Row key={topic} label={topic} value={hz != null ? `${Number(hz).toFixed(1)} Hz` : '—'} />;
        })}
        <p className="eyebrow text-muted mb-3 mt-6">Nodes</p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {nodeEntries.length === 0 && <p className="text-muted text-[length:var(--text-small)]">—</p>}
          {nodeEntries.map(([name, ok]) => (
            <div key={name} className="flex items-center gap-2 text-[length:var(--text-small)] text-white/80">
              <Dot ok={!!ok} />
              <span className="truncate font-mono">{name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
