'use client';
import type { ReactNode } from 'react';
import type { BotTelemetry, SysVitals, TopicRate } from '@/lib/telemetry/protocol';
import type { LinkStatus as HookStatus } from '@/lib/telemetry/useBotTelemetry';

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block size-2 shrink-0 rounded-full ${ok ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`}
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

function Bar({ pct, warn = 70, crit = 90 }: { pct: number; warn?: number; crit?: number }) {
  const color = pct >= crit ? 'var(--danger)' : pct >= warn ? '#ffb74d' : 'var(--success)';
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function rateOf(r: TopicRate | number | undefined): { hz: number | null; age: number | null } {
  if (r == null) return { hz: null, age: null };
  if (typeof r === 'number') return { hz: r, age: null };
  return { hz: r.hz ?? null, age: r.age ?? null };
}

function ageLabel(age: number | null): string {
  if (age == null) return 'never';
  if (age < 1) return `${age.toFixed(1)}s ago`;
  return `${age.toFixed(1)}s ago`;
}

function SysGrid({ sys }: { sys?: SysVitals }) {
  if (!sys) return <p className="text-[length:var(--text-small)] text-muted">No vitals yet</p>;
  const rows: ReactNode[] = [];
  if (sys.cpu != null) {
    rows.push(
      <div key="cpu">
        <div className="flex justify-between text-[length:var(--text-small)]"><span className="text-muted">CPU</span><span className="font-mono">{sys.cpu}%</span></div>
        <Bar pct={sys.cpu} />
      </div>,
    );
  }
  if (sys.temp != null) {
    rows.push(
      <div key="temp">
        <div className="flex justify-between text-[length:var(--text-small)]"><span className="text-muted">SoC temp</span><span className="font-mono">{sys.temp}°C</span></div>
        <Bar pct={Math.min(100, (sys.temp / 90) * 100)} warn={67} crit={84} />
      </div>,
    );
  }
  if (sys.mem) {
    const pct = (sys.mem[0] / Math.max(0.01, sys.mem[1])) * 100;
    rows.push(
      <div key="mem">
        <div className="flex justify-between text-[length:var(--text-small)]"><span className="text-muted">RAM</span><span className="font-mono">{sys.mem[0]} / {sys.mem[1]} GB</span></div>
        <Bar pct={pct} warn={75} crit={90} />
      </div>,
    );
  }
  if (sys.disk) {
    const pct = (sys.disk[0] / Math.max(0.01, sys.disk[1])) * 100;
    rows.push(
      <div key="disk">
        <div className="flex justify-between text-[length:var(--text-small)]"><span className="text-muted">Disk /</span><span className="font-mono">{sys.disk[0]} / {sys.disk[1]} GB</span></div>
        <Bar pct={pct} warn={80} crit={95} />
      </div>,
    );
  }
  if (sys.load != null) rows.push(<Row key="load" label="load 1m" value={String(sys.load)} />);
  if (sys.up) rows.push(<Row key="up" label="uptime" value={sys.up} />);
  if (sys.throttled) {
    rows.push(
      <div key="th" className="rounded border border-[var(--danger)]/40 px-2 py-1 text-[length:var(--text-small)] text-[var(--danger)]">
        PI THROTTLED 0x{sys.throttled.toString(16)}
      </div>,
    );
  }
  return <div className="flex flex-col gap-2">{rows}</div>;
}

export function StatusBoard({
  frame,
  status,
  lagMs,
  dense = false,
}: {
  frame: BotTelemetry | null;
  status: HookStatus;
  lagMs: number;
  dense?: boolean;
}) {
  const pose = frame?.pose;
  const rates = frame?.rates ?? {};
  const nodes = frame?.nodes ?? {};
  const tf = frame?.tf ?? {};
  const nodeEntries = Object.entries(nodes);

  return (
    <div className={`grid gap-5 ${dense ? '' : 'md:grid-cols-2'}`}>
      <section>
        <p className="eyebrow text-muted mb-3">System</p>
        <Row label="Link" value={status.toUpperCase()} />
        <Row label="Lag" value={`${Math.round(lagMs)} ms`} />
        <Row
          label="Pose odom"
          value={pose ? `${pose[0].toFixed(2)}, ${pose[1].toFixed(2)}, ${(pose[2] * 57.2958).toFixed(1)}°` : '—'}
        />
        <Row
          label="Map pose"
          value={frame?.mapPose ? `${frame.mapPose[0]}, ${frame.mapPose[1]}, ${frame.mapPose[2]}` : '—'}
        />
        <Row
          label="Vel"
          value={frame ? `${frame.vel[0].toFixed(2)} m/s · ${frame.vel[1].toFixed(2)} rad/s` : '—'}
        />
        <Row
          label="Cmd"
          value={frame ? `${frame.cmd[0].toFixed(2)} · ${frame.cmd[1].toFixed(2)}` : '—'}
        />
        <Row label="Gyro z" value={frame?.imu ? frame.imu.gz.toFixed(3) : '—'} />
        <Row label="Nav" value={frame?.nav?.status ?? frame?.nav?.feedback ?? '—'} />
        <div className="mt-3">
          <SysGrid sys={frame?.sys} />
        </div>
      </section>

      <section>
        <p className="eyebrow text-muted mb-3">Topics · Hz · last active</p>
        {Object.keys(rates).length === 0 && (
          <p className="text-[length:var(--text-small)] text-muted">No rate data</p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[length:var(--text-small)]">
            <tbody>
              {Object.entries(rates).map(([topic, r]) => {
                const { hz, age } = rateOf(r);
                const stale = age == null || age > 2;
                return (
                  <tr key={topic} className="border-b border-white/10">
                    <td className="py-1.5 pr-2 font-mono text-white/80">{topic}</td>
                    <td className="py-1.5 pr-2 font-mono tabular-nums text-white/90">
                      {hz != null ? `${Number(hz).toFixed(1)} Hz` : '—'}
                    </td>
                    <td className={`py-1.5 font-mono tabular-nums ${stale ? 'text-[var(--danger)]' : 'text-muted'}`}>
                      {ageLabel(age)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="eyebrow text-muted mb-3 mt-5">Nodes</p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {nodeEntries.length === 0 && <p className="text-[length:var(--text-small)] text-muted">—</p>}
          {nodeEntries.map(([name, ok]) => (
            <div key={name} className="flex items-center gap-2 text-[length:var(--text-small)] text-white/80">
              <Dot ok={!!ok} />
              <span className="truncate font-mono">{name}</span>
            </div>
          ))}
        </div>

        <p className="eyebrow text-muted mb-3 mt-5">TF</p>
        {Object.keys(tf).length === 0 && <p className="text-[length:var(--text-small)] text-muted">—</p>}
        {Object.entries(tf).map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-2 border-b border-white/10 py-1 text-[length:var(--text-small)]">
            <span className="flex items-center gap-2 font-mono text-white/80">
              <Dot ok={!!v.ok} />
              {k}
            </span>
            <span className="font-mono text-muted tabular-nums">
              {v.ok ? `age ${v.age ?? '—'}s` : 'MISSING'}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
