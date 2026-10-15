'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { asset } from '@/lib/asset';
import { useAuth } from '@/lib/useAuth';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { PillButton } from '@/components/nav/PillButton';
import { readConfig } from '@/lib/config';
import { getAuthClient } from '@/services/supabase-client';
import { canDrive, RANK_LABEL, type BotId } from '@/lib/telemetry/protocol';
import { useBotTelemetry } from '@/lib/telemetry/useBotTelemetry';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StatusBoard } from './StatusBoard';
import { CameraFeed } from './CameraFeed';
import { ControlPad } from './ControlPad';

const BotScene = dynamic(() => import('./BotScene').then((m) => m.BotScene), { ssr: false });

function statusTone(s: string) {
  if (s === 'online') return 'text-[var(--success)]';
  if (s === 'degraded') return 'text-[#ffb74d]';
  if (s === 'connecting') return 'text-muted';
  return 'text-[var(--danger)]';
}

function Inner() {
  const { session, signOut } = useAuth();
  const cfg = readConfig();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) return;
    let live = true;
    getAuthClient(cfg.supabaseUrl, cfg.supabaseKey).then(async (c) => {
      if (!live) return;
      setClient(c);
      const { data } = await c.auth.getSession();
      const u = data.session?.user;
      if (u) setUser({ id: u.id, email: u.email ?? session?.email });
    });
    return () => { live = false; };
  }, [cfg.supabaseUrl, cfg.supabaseKey, session?.email]);

  const tel = useBotTelemetry(client, user, 'amr4');
  const rank = tel.profile?.rank ?? 0;
  const canDriveNow = tel.iAmController && canDrive(rank);
  const canEstop = canDrive(rank);
  const show3d = tel.viewMode === 'full' && tel.status !== 'offline';

  return (
    <div className="relative min-h-[calc(100dvh-var(--nav-h))] w-full px-[var(--gutter)] py-6 md:py-8">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(123,47,247,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(232,28,176,0.12), transparent 50%), linear-gradient(180deg, #050507 0%, #0a0a10 100%)',
        }}
        aria-hidden
      />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">AMR remote control</p>
          <h1 className="mt-2 font-display text-[length:var(--text-h3)] font-semibold tracking-tight text-white">
            Control
          </h1>
          {session?.email && (
            <p className="mt-1 text-[length:var(--text-small)] text-muted">
              {session.email}
              {tel.profile != null && (
                <> · {RANK_LABEL[tel.profile.rank]}</>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[length:var(--text-small)] text-muted">
            Bot
            <select
              className="rounded-[var(--radius-chip)] border border-white/15 bg-black/40 px-3 py-2 text-white"
              value={tel.botId}
              onChange={(e) => tel.setBotId(e.target.value as BotId)}
            >
              {tel.bots.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </label>
          <PillButton kind="ghost" onClick={async () => { await signOut(); window.location.replace(asset('/login/')); }}>
            Sign out
          </PillButton>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-[length:var(--text-small)]">
        <span className={`font-mono uppercase tracking-wider ${statusTone(tel.status)}`}>
          {tel.status === 'offline' ? 'BOT OFFLINE' : tel.status}
        </span>
        {tel.status !== 'offline' && (
          <span className="text-muted font-mono">lag {Math.round(tel.lagMs)} ms · {tel.viewMode}</span>
        )}
        {tel.controller ? (
          <span className="text-muted">
            Control: {tel.controller.email ?? tel.controller.userId.slice(0, 8)} ({RANK_LABEL[tel.controller.rank]})
            {tel.iAmController ? ' — you' : ' — view only'}
          </span>
        ) : (
          <span className="text-muted">No active controller</span>
        )}
        {!tel.iAmController && canDrive(tel.profile?.rank ?? 0) && (
          <PillButton kind="filled" onClick={() => void tel.requestControl()}>
            Take control
          </PillButton>
        )}
        {tel.iAmController && (
          <PillButton kind="ghost" onClick={() => void tel.releaseControl()}>
            Release
          </PillButton>
        )}
      </div>

      {tel.status === 'offline' ? (
        <div className="grid min-h-[50vh] place-items-center border border-white/10 bg-black/30 px-6 py-16 text-center">
          <div>
            <p className="font-display text-[length:var(--text-h3)] text-white">BOT OFFLINE</p>
            <p className="mt-3 max-w-md text-[length:var(--text-small)] text-muted">
              No heartbeat from the Pi bridge (Tailscale / Cloudflare). Last frame older than 3 seconds.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.7fr)]">
          <div className="min-h-[360px] border border-white/10 bg-black/25">
            {show3d ? (
              <BotScene frame={tel.frame} map={tel.map} className="h-[min(62vh,560px)]" />
            ) : (
              <div className="p-5 md:p-6">
                <p className="eyebrow text-muted mb-4">Status board</p>
                <p className="mb-4 text-[length:var(--text-small)] text-muted">
                  Link lag is high — falling back from 10 Hz 3D to board mode.
                </p>
                <StatusBoard frame={tel.frame} status={tel.status} lagMs={tel.lagMs} />
              </div>
            )}
          </div>
          <aside className="flex flex-col gap-4">
            <div className="border border-white/10 bg-black/25 p-4">
              <p className="eyebrow text-muted mb-3">Drive</p>
              <ControlPad
                canDrive={canDriveNow}
                canEstop={canEstop}
                onCommand={(cmd) => { void tel.sendCommand(cmd); }}
              />
              {!canDriveNow && (
                <p className="mt-3 text-[length:var(--text-small)] text-muted">
                  {canDrive(rank)
                    ? 'Take control to drive. Higher authority preempts lower; others stay in view-only.'
                    : 'Viewer rank — observation only. Ask an admin to raise your authority.'}
                </p>
              )}
            </div>
            <div className="border border-white/10 bg-black/25 overflow-hidden">
              <CameraFeed frame={tel.frame} enabled={tel.viewMode === 'full'} />
            </div>
            {show3d && (
              <div className="border border-white/10 bg-black/25 p-4">
                <StatusBoard frame={tel.frame} status={tel.status} lagMs={tel.lagMs} />
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

/** Live remote control panel (replaces coming-soon stub). Hosted at /control on amrslam.tech. */
export function ControlPanel() {
  return (
    <AuthGuard>
      <Inner />
    </AuthGuard>
  );
}
