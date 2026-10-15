'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/asset';
import { useAuth } from '@/lib/useAuth';
import { PillButton } from '@/components/nav/PillButton';
import { readConfig } from '@/lib/config';
import { getAuthClient } from '@/services/supabase-client';
import { canDrive, RANK_LABEL, type BotId } from '@/lib/telemetry/protocol';
import { useBotTelemetry } from '@/lib/telemetry/useBotTelemetry';
import type { SupabaseClient } from '@supabase/supabase-js';
import { StatusBoard } from './StatusBoard';
import { CameraFeed } from './CameraFeed';
import { ControlPad } from './ControlPad';
import { LiveMap, type CanvasNavMode } from './LiveMap';
import { ToolsPanel } from './ToolsPanel';
import { ConsolePanel } from './ConsolePanel';
import { XboxGamepad } from './XboxGamepad';
import { BackgroundFx } from './BackgroundFx';

type WorldPt = [number, number];

function statusTone(s: string) {
  if (s === 'online') return 'text-[var(--success)]';
  if (s === 'degraded') return 'text-[#ffb74d]';
  if (s === 'connecting') return 'text-muted';
  return 'text-[var(--danger)]';
}

const NAV_MODES: { id: CanvasNavMode; label: string }[] = [
  { id: 'off', label: 'View' },
  { id: 'goal', label: 'Goal pose' },
  { id: 'sequential', label: 'Sequential' },
  { id: 'nogo', label: 'No-go' },
];

function Inner() {
  const { session, signOut } = useAuth();
  const cfg = readConfig();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [navMode, setNavMode] = useState<CanvasNavMode>('off');
  const [seqQueue, setSeqQueue] = useState<WorldPt[]>([]);
  const [blDuration, setBlDuration] = useState(300);
  const [xboxOpen, setXboxOpen] = useState(false);
  const seqBusyRef = useRef(false);
  const lastGoalRef = useRef<[number, number] | null>(null);
  const sendRef = useRef<(cmd: Parameters<ReturnType<typeof useBotTelemetry>['sendCommand']>[0]) => void>(() => {});

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
  const showLive = tel.status !== 'offline';

  const sendCmd = tel.sendCommand;
  const send = useCallback((cmd: Parameters<typeof sendCmd>[0]) => {
    void sendCmd(cmd);
  }, [sendCmd]);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Advance sequential queue when active goal clears / nav finishes
  useEffect(() => {
    const goal = tel.frame?.goal ?? null;
    const prev = lastGoalRef.current;
    lastGoalRef.current = goal;

    if (!canDriveNow || navMode !== 'sequential') return;
    if (seqBusyRef.current) {
      const cleared = prev != null && goal == null;
      const navDone = tel.frame?.nav?.status && /succeed|abort|cancel|reject/i.test(String(tel.frame.nav.status));
      if (cleared || navDone) {
        seqBusyRef.current = false;
      } else {
        return;
      }
    }
    if (goal != null) return;

    // Peek queue via functional update; only mutate when we actually dispatch.
    setSeqQueue((q) => {
      if (!q.length) return q;
      const [next, ...rest] = q;
      seqBusyRef.current = true;
      // Defer command so we don't send during the setState updater.
      queueMicrotask(() => sendRef.current({ type: 'nav_goal', x: next[0], y: next[1] }));
      return rest;
    });
  }, [tel.frame?.goal, tel.frame?.nav?.status, tel.frame?.seq, canDriveNow, navMode]);

  const setNavModeSafe = (mode: CanvasNavMode) => {
    if (mode !== 'sequential') {
      seqBusyRef.current = false;
      setSeqQueue([]);
    }
    setNavMode(mode);
  };

  const onNavGoal = useCallback((x: number, y: number) => {
    if (!canDriveNow) return;
    if (navMode === 'sequential') {
      setSeqQueue((q) => {
        const next = [...q, [x, y] as WorldPt];
        if (!seqBusyRef.current && !lastGoalRef.current) {
          const [first, ...rest] = next;
          seqBusyRef.current = true;
          sendRef.current({ type: 'nav_goal', x: first[0], y: first[1] });
          return rest;
        }
        return next;
      });
      return;
    }
    if (navMode === 'goal') {
      sendRef.current({ type: 'nav_goal', x, y });
    }
  }, [canDriveNow, navMode]);

  const onBlacklist = useCallback((x: number, y: number, radius: number) => {
    if (!canDriveNow) return;
    sendRef.current({
      type: 'blacklist',
      action: 'add',
      x,
      y,
      radius,
      duration: blDuration,
    });
  }, [canDriveNow, blDuration]);

  const cancelNav = () => {
    seqBusyRef.current = false;
    setSeqQueue([]);
    send({ type: 'nav_cancel' });
  };

  return (
    <div className="relative min-h-[calc(100dvh-var(--nav-h))] w-full px-[var(--gutter)] py-5 md:py-7">
      <BackgroundFx />

      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-muted">AMR remote control</p>
          <h1 className="mt-2 font-display text-[length:var(--text-h3)] font-semibold tracking-tight text-white">
            Control
          </h1>
          {session?.email && (
            <p className="mt-1 text-[length:var(--text-small)] text-muted">
              {session.email}
              {tel.profile != null && <> · {RANK_LABEL[tel.profile.rank]}</>}
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
          <PillButton kind="filled" onClick={() => setXboxOpen(true)}>
            Controller
          </PillButton>
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
          <span className="font-mono text-muted">lag {Math.round(tel.lagMs)} ms · {tel.viewMode}</span>
        )}
        {tel.frame?.tool && (
          <span className="rounded-full bg-amber-400/15 px-2 py-0.5 font-mono text-amber-200">{tel.frame.tool}</span>
        )}
        {tel.frame?.vision && (
          <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 font-mono text-emerald-300">VISION</span>
        )}
        {tel.frame?.saving && (
          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 font-mono text-sky-300">SAVING MAP</span>
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
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
          {/* Live 2D viz */}
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden border border-white/10 bg-black/30">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                <p className="eyebrow text-muted">Live view — odom · 2D bot</p>
                {tel.viewMode === 'board' && (
                  <span className="font-mono text-[10px] text-[#ffb74d]">board mode (high lag)</span>
                )}
              </div>
              <div className="h-[min(58vh,620px)] min-h-[320px]">
                {showLive && (
                  <LiveMap
                    frame={tel.frame}
                    map={tel.map}
                    navMode={navMode}
                    sequentialQueue={seqQueue}
                    canInteract={canDriveNow}
                    onNavGoal={onNavGoal}
                    onBlacklist={onBlacklist}
                    className="h-full"
                  />
                )}
              </div>
              {/* Pose readouts */}
              <div className="grid grid-cols-3 gap-2 border-t border-white/10 p-3 font-mono text-[11px] sm:grid-cols-5 md:grid-cols-9">
                {[
                  ['x', tel.frame?.pose?.[0]?.toFixed(2) ?? '–'],
                  ['y', tel.frame?.pose?.[1]?.toFixed(2) ?? '–'],
                  ['yaw°', tel.frame?.pose ? (tel.frame.pose[2] * 57.2958).toFixed(1) : '–'],
                  ['v', tel.frame?.vel?.[0]?.toFixed(2) ?? '–'],
                  ['ω', tel.frame?.vel?.[1]?.toFixed(2) ?? '–'],
                  ['gyro', tel.frame?.imu?.gz?.toFixed(3) ?? '–'],
                  ['cmd v', tel.frame?.cmd?.[0]?.toFixed(2) ?? '–'],
                  ['cmd ω', tel.frame?.cmd?.[1]?.toFixed(2) ?? '–'],
                  ['map', tel.frame?.mapPose ? `${tel.frame.mapPose[0]}, ${tel.frame.mapPose[1]}` : '–'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded bg-white/[0.03] px-2 py-1.5">
                    <div className="text-[9px] uppercase tracking-wider text-muted">{k}</div>
                    <div className="text-white/90 tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Nav modes */}
            <div className="flex flex-wrap items-center gap-2 border border-white/10 bg-black/25 p-3">
              <span className="eyebrow text-muted mr-1">Nav mode</span>
              {NAV_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`rounded-[var(--radius-chip)] border px-3 py-1.5 text-[length:var(--text-small)] transition ${
                    navMode === m.id
                      ? 'border-white/30 bg-white/15 text-white'
                      : 'border-white/10 text-muted hover:bg-white/5'
                  }`}
                  onClick={() => setNavModeSafe(m.id)}
                >
                  {m.label}
                </button>
              ))}
              <button
                type="button"
                className="rounded-[var(--radius-chip)] border border-white/15 px-3 py-1.5 text-[length:var(--text-small)] text-white/80 disabled:opacity-40"
                disabled={!canDriveNow}
                onClick={cancelNav}
              >
                Cancel goal
              </button>
              {navMode === 'nogo' && (
                <>
                  <select
                    className="rounded border border-white/15 bg-black/40 px-2 py-1.5 text-[length:var(--text-small)] text-white"
                    value={blDuration}
                    onChange={(e) => setBlDuration(Number(e.target.value))}
                  >
                    <option value={60}>1 min</option>
                    <option value={300}>5 min</option>
                    <option value={900}>15 min</option>
                    <option value={0}>permanent</option>
                  </select>
                  <button
                    type="button"
                    className="rounded-[var(--radius-chip)] border border-white/15 px-3 py-1.5 text-[length:var(--text-small)] text-white/80 disabled:opacity-40"
                    disabled={!canDriveNow}
                    onClick={() => send({ type: 'blacklist', action: 'clear' })}
                  >
                    Clear zones
                  </button>
                </>
              )}
              {navMode === 'sequential' && seqQueue.length > 0 && (
                <span className="font-mono text-[11px] text-[#c792ea]">queue {seqQueue.length}</span>
              )}
            </div>

            {/* Console */}
            <div className="border border-white/10 bg-black/25 p-3">
              <p className="eyebrow text-muted mb-2">Console</p>
              <ConsolePanel logs={tel.logs} />
            </div>
          </div>

          {/* Right column */}
          <aside className="flex flex-col gap-4">
            <div className="border border-white/10 bg-black/25 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="eyebrow text-muted">Drive</p>
                <button
                  type="button"
                  className="rounded-[var(--radius-chip)] border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-[length:var(--text-small)] text-cyan-200"
                  onClick={() => setXboxOpen(true)}
                >
                  Xbox controller
                </button>
              </div>
              <ControlPad
                canDrive={canDriveNow}
                canEstop={canEstop}
                onCommand={send}
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
              <div className="border-b border-white/10 px-3 py-2">
                <p className="eyebrow text-muted">Camera</p>
              </div>
              <CameraFeed
                frame={tel.frame}
                enabled={
                  tel.viewMode === 'full'
                  && !!(tel.frame?.vision || tel.frame?.cameraJpegB64 || tel.frame?.cameraUrl)
                }
              />
              {!tel.frame?.vision && !tel.frame?.cameraJpegB64 && !tel.frame?.cameraUrl && (
                <p className="px-3 py-2 text-[length:var(--text-small)] text-muted">
                  Vision off — start vision in Tools to see camera feed
                </p>
              )}
            </div>

            <div className="border border-white/10 bg-black/25 p-4">
              <p className="eyebrow text-muted mb-3">Tools</p>
              <ToolsPanel frame={tel.frame} canDrive={canDriveNow} onCommand={send} />
            </div>

            <div className="border border-white/10 bg-black/25 p-4">
              <p className="eyebrow text-muted mb-3">System status</p>
              <StatusBoard frame={tel.frame} status={tel.status} lagMs={tel.lagMs} dense />
            </div>
          </aside>
        </div>
      )}

      <XboxGamepad
        open={xboxOpen}
        canDrive={canDriveNow}
        canEstop={canEstop}
        onClose={() => setXboxOpen(false)}
        onCommand={send}
      />
    </div>
  );
}

/** Live remote control panel. Lazy-loaded from ControlStub (AuthGuard wraps outside). */
export function ControlPanel() {
  return <Inner />;
}
