'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/lib/useAuth';
import { readConfig } from '@/lib/config';
import { asset } from '@/lib/asset';
import { getAuthClient, getBroadcastClient } from '@/services/supabase-client';
import { BOTS, type BotId, type ControlCommand } from '@/lib/telemetry/protocol';
import { offlineMessage, type LinkPhase } from '@/lib/telemetry/link-status';
import { SIGN_DOWN, SIGN_ERROR, SIGN_NO_DATA, type StatusSignId } from '@/lib/telemetry/status-signs';
import { useControlSession } from '@/lib/telemetry/useControlSession';
import { clampLinAng, clampToolParams, commandRejectText, estopLatchAllowed, mapNameError, JOY_HZ, NUDGE_REPEAT_MS, ESTOP_RETRY_MS } from '@/lib/telemetry/commands';
import { COPY, countdownFraction, formatCountdown, initialOf, secondsRemaining } from '@/lib/control/access';
import type { NormState } from '@/lib/telemetry/normalize';
import { LiveCanvas } from './LiveCanvas';
import './dashboard.css';

const NODES = [
  'robot_state_publisher', 'imu_node', 'driver_node', 'odom_node', 'rplidar_node', 'scan_min_range_filter',
  'ekf_filter_node', 'slam_toolbox', 'joy_node', 'joy_teleop', 'camera_servo', 'bt_navigator',
  'controller_server', 'planner_server', 'behavior_server', 'velocity_smoother', 'collision_monitor',
];
const TOPICS = ['/scan', '/odom', '/odom_raw', '/imu', '/map', '/cmd_vel', '/yolo'];

type Mode = 'none' | 'nav' | 'nogo';
type Estop = 'ready' | 'retrying' | 'latched';

export function Dashboard() {
  const { session, signOut } = useAuth();
  const cfg = readConfig();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [broadcastClient, setBroadcastClient] = useState<SupabaseClient | null>(null);
  const [botId, setBotId] = useState<BotId>('amr4');
  const userId = session?.userId ?? null;
  const tel = useControlSession(client, userId, botId, broadcastClient);

  const [mode, setMode] = useState<Mode>('none');
  const [scale, setScale] = useState(70);
  const [duration, setDuration] = useState(300);
  const [showSlam, setShowSlam] = useState(false);
  const [estop, setEstop] = useState<Estop>('ready');
  const [hold, setHold] = useState(0);
  const [mapName, setMapName] = useState('');
  const [areaClear, setAreaClear] = useState(false);
  const [imu, setImu] = useState({ speed: '0.5', rotations: '2' });
  const [drive, setDrive] = useState({ distance: '1.0', maxVel: '0.3' });
  const [visionAt, setVisionAt] = useState(0);
  const [account, setAccount] = useState(false);
  const [help, setHelp] = useState(false);
  const [padLabel, setPadLabel] = useState<'none' | 'connected' | 'idle'>('none');
  const [toasts, setToasts] = useState<{ id: number; text: string; until: number }[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [flash, setFlash] = useState<'granted' | 'denied' | 'timeout' | null>(null);
  const [promptNote, setPromptNote] = useState<string | null>(null);
  const [retryStamp, setRetryStamp] = useState<{ after: number | null; until: number | null }>({ after: null, until: null });
  const toastId = useRef(0);
  const prevController = useRef<string | null | undefined>(undefined);
  const prevMine = useRef<string | null>(null);
  const joined = useRef(false);
  const estopTimer = useRef(0);
  const holdTimer = useRef(0);
  const helpRef = useRef(false);
  const canEditRef = useRef(false);
  const controllerRef = useRef(false);
  const pendingRef = useRef(0);
  const timedOutRef = useRef<string | null>(null);
  const answerRef = useRef<(accept: boolean) => void>(() => {});
  const fireEstopRef = useRef<() => void>(() => {});
  const startNudgeRef = useRef<(lin: number, ang: number) => void>(() => {});
  const stopNudgeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!cfg.supabaseUrl || !cfg.supabaseKey) return;
    let live = true;
    Promise.all([
      getAuthClient(cfg.supabaseUrl, cfg.supabaseKey),
      getBroadcastClient(cfg.supabaseUrl, cfg.supabaseKey),
    ]).then(([auth, broadcast]) => {
      if (!live) return;
      setClient(auth);
      setBroadcastClient(broadcast);
    });
    return () => { live = false; };
  }, [cfg.supabaseUrl, cfg.supabaseKey]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const toast = useCallback((text: string, ms = 4000) => {
    const id = ++toastId.current;
    setToasts((q) => [...q, { id, text, until: Date.now() + ms }]);
  }, []);

  useEffect(() => {
    const first = toasts[0];
    if (!first) return;
    const wait = Math.max(0, first.until - Date.now());
    const id = window.setTimeout(() => setToasts((q) => q.slice(1)), wait);
    return () => window.clearTimeout(id);
  }, [toasts]);

  if (tel.retryAfter !== retryStamp.after) {
    setRetryStamp({
      after: tel.retryAfter,
      until: tel.retryAfter == null ? null : now + tel.retryAfter * 1000,
    });
  }
  const retryUntil = retryStamp.until;
  const retryLeft = retryUntil == null ? 0 : Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const pulse = retryUntil != null && now >= retryUntil;

  const controller = tel.role === 'controller';
  if (!controller && estop !== 'ready') setEstop('ready');
  const robotLive = tel.link.phase === 'live';
  const canEstop = controller;
  const canEdit = canEstop && estop === 'ready' && robotLive && !tel.heartbeatStale && !tel.realtimeDown;
  const highLag = robotLive && tel.slowLink;
  const bot = BOTS.find((b) => b.id === botId)!;

  const send = useCallback(async (cmd: ControlCommand) => {
    const res = await tel.sendCommand(cmd);
    if (!res.ok && cmd.type !== 'estop') {
      const text = commandRejectText(res.error) || res.error || 'Command failed';
      toast(text, 4000);
      tel.pushLog('error', text);
    }
    return res.ok;
  }, [tel, toast]);

  const fireEstop = useCallback(() => {
    if (!controller) return;
    window.clearTimeout(estopTimer.current);
    setEstop('retrying');
    let told = '';
    const attempt = async () => {
      if (!controllerRef.current) return;
      const res = await tel.sendCommand({ type: 'estop' });
      if (estopLatchAllowed(res)) {
        setEstop('latched');
        tel.pushLog('error', COPY.estopLog);
        return;
      }
      const text = res.error || COPY.estopFail;
      if (text !== told) {
        told = text;
        toast(text, 4000);
        tel.pushLog('error', text);
      }
      estopTimer.current = window.setTimeout(() => { void attempt(); }, ESTOP_RETRY_MS);
    };
    void attempt();
  }, [controller, tel, toast]);

  function startRearm() {
    if (estop !== 'latched') return;
    const start = Date.now();
    window.clearInterval(holdTimer.current);
    holdTimer.current = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 1000);
      setHold(p);
      if (p >= 1) {
        window.clearInterval(holdTimer.current);
        setEstop('ready');
        setHold(0);
      }
    }, 30);
  }
  function cancelRearm() {
    window.clearInterval(holdTimer.current);
    setHold(0);
  }

  useEffect(() => () => { window.clearTimeout(estopTimer.current); window.clearInterval(holdTimer.current); }, []);

  useEffect(() => {
    if (controller) return;
    window.clearTimeout(estopTimer.current);
  }, [controller]);

  useEffect(() => {
    const id = tel.controllerId;
    if (prevController.current === undefined) { prevController.current = id; return; }
    if (prevController.current !== id) {
      const name = id == null ? 'No one' : id === userId ? 'You' : (tel.controllerName || tel.names[id] || 'Someone');
      if (id != null) toast(COPY.nowDriving(name === 'You' ? (tel.names[id] || 'You') : name));
    }
    prevController.current = id;
  }, [tel.controllerId, tel.controllerName, tel.names, userId, toast]);

  useEffect(() => {
    if (joined.current || tel.joining || !tel.role) return;
    joined.current = true;
    if (tel.role === 'viewer') toast(COPY.joinedViewer, 3000);
  }, [tel.joining, tel.role, toast]);

  useEffect(() => {
    const st = tel.myRequest?.status ?? null;
    const prev = prevMine.current;
    if (prev === 'pending' && st === 'accepted') setFlash('granted');
    if (prev === 'pending' && st === 'denied') setFlash('denied');
    if (prev === 'pending' && st === 'expired') setFlash('timeout');
    prevMine.current = st;
  }, [tel.myRequest]);

  useEffect(() => {
    if (!flash) return;
    const ms = flash === 'granted' ? 1200 : 1600;
    const id = window.setTimeout(() => setFlash(null), ms);
    return () => window.clearTimeout(id);
  }, [flash]);

  const nudgeTimer = useRef(0);
  function startNudge(lin: number, ang: number) {
    if (!canEdit) return;
    const v = clampLinAng(lin, ang);
    void send({ type: 'nudge', ...v });
    window.clearInterval(nudgeTimer.current);
    nudgeTimer.current = window.setInterval(() => { void send({ type: 'nudge', ...v }); }, NUDGE_REPEAT_MS);
  }
  function stopNudge() {
    window.clearInterval(nudgeTimer.current);
    if (controller) void send({ type: 'nudge', lin: 0, ang: 0 });
  }

  const sendRef = useRef(tel.sendCommand);
  const padRef = useRef(padLabel);
  useEffect(() => {
    let timer = 0;
    let alive = true;
    const tick = () => {
      timer = window.setTimeout(tick, 1000 / JOY_HZ);
      if (!alive) return;
      const reading = readGamepad();
      const next = !reading ? 'none' : (!controller || document.hidden ? 'idle' : 'connected');
      if (padRef.current !== next) { padRef.current = next; setPadLabel(next); }
      if (!reading || !controller || document.hidden || !canEdit) return;
      void sendRef.current({ type: 'joy', a: reading.a, b: reading.b });
    };
    timer = window.setTimeout(tick, 1000 / JOY_HZ);
    const stop = () => { if (controller) void sendRef.current({ type: 'joy', a: [0, 0, 0, 0, 0, 0, 0, 0], b: 0 }); };
    window.addEventListener('blur', stop);
    return () => { alive = false; window.clearTimeout(timer); window.removeEventListener('blur', stop); stop(); };
  }, [controller, canEdit]);

  async function answer(accept: boolean) {
    const req = [...tel.pendingRequests].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))[0];
    if (!req) return;
    setPromptNote(null);
    const res = await tel.respond(req.id, accept);
    if (res.kind === 'retry') { setPromptNote(COPY.respondFail); return; }
    if (res.kind === 'ended') { toast(COPY.requestEnded); return; }
    if (res.kind === 'left') { toast(`${res.name ?? 'They'} left.`); return; }
    if (res.kind === 'lost') { toast("You're no longer in control."); return; }
    if (accept) toast(COPY.handed(res.name ?? 'them'), 4000);
    else toast(COPY.kept, 3000);
  }

  useEffect(() => {
    helpRef.current = help;
    canEditRef.current = canEdit;
    controllerRef.current = controller;
    pendingRef.current = tel.pendingRequests.length;
    fireEstopRef.current = fireEstop;
    startNudgeRef.current = startNudge;
    stopNudgeRef.current = stopNudge;
    answerRef.current = (accept) => { void answer(accept); };
    sendRef.current = tel.sendCommand;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = targetEditable(e.target);
      if (e.key === '?' && !typing) { setHelp(true); return; }
      if (helpRef.current && e.key === 'Escape') { setHelp(false); e.preventDefault(); return; }
      if ((e.key === 'g' || e.key === 'G') && pendingRef.current > 0) { e.preventDefault(); answerRef.current(true); return; }
      if ((e.key === 'k' || e.key === 'K') && pendingRef.current > 0) { e.preventDefault(); answerRef.current(false); return; }
      if ((e.key === ' ' || e.key === 'Escape') && !typing) { e.preventDefault(); fireEstopRef.current(); return; }
      if (typing) return;
      if (e.key === '+' || e.key === '=') setScale((s) => Math.min(220, s * 1.12));
      if (e.key === '-' || e.key === '_') setScale((s) => Math.max(25, s * 0.89));
      if (!canEditRef.current) return;
      if (e.key === 'n' || e.key === 'N') setMode((m) => (m === 'nav' ? 'none' : 'nav'));
      if (e.key === 'm' || e.key === 'M') setMode((m) => (m === 'nogo' ? 'none' : 'nogo'));
      if (e.key === 'c' || e.key === 'C') void sendRef.current({ type: 'nav_cancel' });
      const nudge = nudgeFor(e.key);
      if (nudge && !e.repeat) startNudgeRef.current(nudge.lin, nudge.ang);
    };
    const up = (e: KeyboardEvent) => { if (nudgeFor(e.key)) stopNudgeRef.current(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', up); };
  }, []);

  const requests = [...tel.pendingRequests].sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const firstRequest = requests[0];
  useEffect(() => {
    if (!firstRequest || !controller) return;
    if (timedOutRef.current === firstRequest.id) return;
    const leftMs = Date.parse(firstRequest.expiresAt) - now;
    if (leftMs > 0) return;
    const id = firstRequest.id;
    const handle = window.setTimeout(() => {
      timedOutRef.current = id;
      toast(COPY.noResponse, 4000);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [firstRequest, controller, now, toast]);

  const nodes = tel.frame?.nodes ?? {};
  const nodeKeys = Object.keys(nodes);
  const allOk = nodeKeys.length > 0 && nodeKeys.every((k) => nodes[k]);
  const driverName = tel.controllerId == null
    ? null
    : tel.controllerId === userId ? 'You' : (tel.controllerName || tel.names[tel.controllerId] || 'Someone');

  function setExclusive(next: Mode) { setMode((m) => m === next ? 'none' : next); }

  const imuSpeed = Number(imu.speed);
  const imuRot = Number(imu.rotations);
  const dist = Number(drive.distance);
  const maxVel = Number(drive.maxVel);
  const imuOk = clampToolParams('imu_calibration', { speed: imuSpeed, rotations: imuRot }) != null;
  const driveOk = clampToolParams('drive_distance', { distance: dist, maxVel }) != null;
  const toolBusy = !!tel.frame?.tool;

  return (
    <div className="op">
      <div className="op-sticky">
      {(tel.heartbeatStale || tel.realtimeDown || tel.heartbeatError) && (
        <div className="op-reconnect" role="status">{tel.heartbeatError || 'Reconnecting…'}</div>
      )}
      <header className="op-header">
        <h1><span className="op-brand">AMR</span> <span style={{ fontWeight: 600, letterSpacing: '0.02em' }}>{bot.label}</span></h1>
        <div className="op-switch" role="group" aria-label="Bot">
          {BOTS.map((b) => (
            <button key={b.id} type="button" aria-pressed={b.id === botId} onClick={() => { if (b.id !== botId) { setBotId(b.id); joined.current = false; } }}>{b.label}</button>
          ))}
        </div>
        <LinkStatus phase={tel.link.phase} label={tel.link.label} highLag={highLag} />
        {tel.link.showLag && (
          <span className="mono" style={{ color: 'var(--warn)' }} aria-hidden="true">lag {Math.round(tel.lagMs)} ms</span>
        )}
        {robotLive && <span className={`pill ${allOk ? 'ok' : 'bad'}`}>{allOk ? 'ALL SYSTEMS GO' : 'DEGRADED'}</span>}
        {robotLive && tel.frame?.tool && <span className="pill run">⏳ {tel.frame.tool}</span>}
        {robotLive && tel.frame?.vision && <span className="pill vision">👁 VISION ON</span>}
        {robotLive && tel.frame?.saving && <span className="pill saving">💾 SAVING MAP…</span>}
        <div className="op-grow">
          {tel.joining ? <span className="skel" aria-hidden /> : (
            <span className="who" title="Currently driving">
              <span className={`av ${driverName && driverName !== 'No one is driving' ? 'driving' : ''}`}>{initialOf(driverName === 'You' ? (session?.email ?? 'You') : driverName)}</span>
              <span style={{ color: driverName ? 'var(--tx)' : 'var(--dim)' }}>{driverName ?? 'No one is driving'}</span>
            </span>
          )}
          {tel.joining ? <span className="skel" aria-hidden /> : controller ? (
            <span className="pill ok"><Wheel /> You&apos;re in control</span>
          ) : (
            <span className="pill viewer"><Eye /> View only</span>
          )}
          <span style={{ position: 'relative' }}>
            <button type="button" className="av" aria-label="Account" aria-expanded={account} onClick={() => setAccount((v) => !v)}>{initialOf(session?.email)}</button>
            {account && (
              <div className="menu" role="menu">
                <p>{session?.email}</p>
                <button type="button" className="btn" onClick={() => { void signOut().then(() => window.location.replace(asset('/sign-in/'))); }}>Sign out</button>
              </div>
            )}
          </span>
          {canEstop && (
            <button type="button" className={`op-estop ${estop !== 'ready' ? 'latched' : ''}`} title="Space or Esc" onClick={() => { if (estop === 'ready') fireEstop(); }} onPointerDown={() => { if (estop === 'latched') startRearm(); }} onPointerUp={cancelRearm} onPointerLeave={cancelRearm}>
              {estop === 'retrying' ? 'Retrying…' : estop === 'latched' ? 'STOPPED · Re-arm' : 'E-STOP'}
              {estop === 'latched' && <span className="hold" style={{ width: `${hold * 100}%` }} />}
            </button>
          )}
        </div>
      </header>
      {controller && estop === 'latched' && <div className="op-estop-bar" role="status">EMERGENCY STOP ACTIVE</div>}
      <div className="op-signs">
        <Sign id="nodata" on={tel.signs.active === 'nodata'} label={SIGN_NO_DATA} />
        <Sign id="down" on={tel.signs.active === 'down'} label={SIGN_DOWN} />
        <Sign id="error" on={tel.signs.active === 'error'} label={SIGN_ERROR} detail={tel.signs.errorReason} />
        {tel.channelNote && <span className="op-note">{tel.channelNote}</span>}
        <span className="op-telem mono" aria-label="Telemetry">
          x {fmt(tel.frame?.pose?.[0], 2)} · y {fmt(tel.frame?.pose?.[1], 2)} · yaw {tel.frame?.pose ? (tel.frame.pose[2] * 57.2958).toFixed(1) : '–'}° · v {fmt(tel.frame?.vel[0], 2)} m/s
        </span>
      </div>
      </div>

      {controller && requests.length > 0 && (
        <div className="stack">
          {requests.length > 1 && <span className="chip">+{requests.length - 1} waiting</span>}
          {requests.map((r, i) => {
            const left = secondsRemaining(r.expiresAt, now);
            const timed = left <= 0;
            return (
              <div key={r.id} className="prompt" role="alertdialog" aria-live="assertive" aria-label={`${r.name} is there`}>
                <div className="who">
                  <span className="av">{initialOf(r.name)}</span>
                  <div>
                    <h3>{r.name} is there</h3>
                    <p>They&apos;d like to take control. Give it to them?</p>
                  </div>
                  {i === 0 && <span className={`count ${left <= 3 ? 'warn' : ''}`}>{timed ? 'Timed out' : left}</span>}
                </div>
                {i === 0 && <div className={`cbar ${left <= 3 ? 'warn' : ''}`}><i style={{ width: `${countdownFraction(r.expiresAt, now) * 100}%`, background: left <= 3 ? 'var(--warn)' : 'var(--run)' }} /></div>}
                {i === 0 && promptNote && <p className="err" role="alert">⚠ {promptNote}</p>}
                {i === 0 && !timed && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <button type="button" className="btn" onClick={() => void answer(true)}>Give control</button>
                    <button type="button" className="btn ghost" onClick={() => void answer(false)}>Keep control</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="op-grid">
        <section className="card" aria-label="Live view">
          <h2>Live view — odom frame · wheel-zoom · click = nav goal (when armed)</h2>
          {tel.link.phase === 'offline' && (
            <div className="offline">
              <p style={{ color: 'var(--tx)', fontWeight: 700 }}>
                {tel.link.unreadable ? tel.link.label : `${bot.label} is offline`}
              </p>
              <p>
                {tel.link.unreadable
                  ? tel.link.offlineDetail
                  : offlineMessage(tel.link.offlineDetail ?? '', tel.link.lastSeenAtMs, now)}
              </p>
            </div>
          )}
          {!robotLive && <p className="help">Waiting for robot…</p>}
          <LiveCanvas state={tel.frame} map={tel.map} scale={scale} onScale={setScale} canEdit={canEdit} mode={mode} showSlam={showSlam} lastAt={tel.lastTelemetryAt} placeholder={tel.link.mapPlaceholder} onNav={(x, y) => void send({ type: 'nav_goal', x, y })} onBlacklist={(x, y, radius) => void send({ type: 'blacklist', action: 'add', x, y, radius, duration })} />
          <div className="readouts">
            <Tile k="x (odom)" v={fmt(tel.frame?.pose?.[0], 2)} />
            <Tile k="y (odom)" v={fmt(tel.frame?.pose?.[1], 2)} />
            <Tile k="yaw°" v={tel.frame?.pose ? (tel.frame.pose[2] * 57.2958).toFixed(1) : '–'} />
            <Tile k="v m/s" v={fmt(tel.frame?.vel[0], 2)} />
            <Tile k="ω rad/s" v={fmt(tel.frame?.vel[1], 2)} />
            <Tile k="gyro z" v={tel.frame ? tel.frame.imu.gz.toFixed(3) : '–'} />
            <Tile k="cmd v" v={fmt(tel.frame?.cmd[0], 2)} />
            <Tile k="cmd ω" v={fmt(tel.frame?.cmd[1], 2)} />
            <Tile k="map pose" v={tel.frame?.mapPose ? `${tel.frame.mapPose[0].toFixed(2)}, ${tel.frame.mapPose[1].toFixed(2)}` : '–'} />
          </div>
          <div className={`navmode ${canEdit ? '' : 'locked'}`} aria-disabled={!canEdit}>
            <label><input type="checkbox" checked={mode === 'nav'} onChange={() => setExclusive('nav')} /> Nav-goal mode (click canvas to send goal)</label>
            <button type="button" className="btn stop" style={{ padding: '4px 12px' }} onClick={() => void send({ type: 'nav_cancel' })}>cancel goal</button>
            <label title="Waypoint sequences aren't available remotely yet."><input type="checkbox" disabled /> 📍 Seq-add mode (click = add waypoint)</label>
            <label><input type="checkbox" checked={mode === 'nogo'} onChange={() => setExclusive('nogo')} /> 🚫 No-go mode (drag a circle)</label>
            <select aria-label="No-go duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
              <option value={900}>15 min</option>
              <option value={0}>permanent</option>
            </select>
            <button type="button" className="btn stop" onClick={() => void send({ type: 'blacklist', action: 'clear' })}>clear zones</button>
            {tel.map && <label><input type="checkbox" checked={showSlam} onChange={(e) => setShowSlam(e.target.checked)} /> Show SLAM map</label>}
          </div>
          <div className="pad" aria-disabled={!canEdit}>
            <span />
            <PadButton label="Forward" glyph="▲" disabled={!canEdit} onDown={() => startNudge(0.15, 0)} onUp={stopNudge} />
            <span />
            <PadButton label="Rotate left" glyph="◀" disabled={!canEdit} onDown={() => startNudge(0, 0.6)} onUp={stopNudge} />
            <button type="button" aria-label="E-STOP" disabled={!canEstop} onClick={() => { if (estop === 'ready') fireEstop(); }}>■</button>
            <PadButton label="Rotate right" glyph="▶" disabled={!canEdit} onDown={() => startNudge(0, -0.6)} onUp={stopNudge} />
            <span />
            <PadButton label="Back" glyph="▼" disabled={!canEdit} onDown={() => startNudge(-0.15, 0)} onUp={stopNudge} />
            <span />
          </div>
          {!controller && <p className="help">Only the driver can emergency-stop.</p>}
        </section>

        <div className="right">
          {!controller && (
            <AccessBanner
              flash={flash}
              name={driverName}
              waitingFor={tel.controllerName || driverName}
              my={tel.myRequest}
              now={now}
              retryLeft={retryLeft}
              pulse={pulse}
              error={tel.requestError === 'network' || tel.requestError === 'join'}
              offline={tel.link.phase === 'offline'}
              onRequest={() => void tel.requestControl()}
              onCancel={() => { if (tel.myRequest) void tel.cancelRequest(tel.myRequest.id); }}
              onRetry={() => { if (tel.requestError) void tel.requestControl(); }}
            />
          )}
          <SystemCard frame={tel.frame} canEdit={canEdit} mapName={mapName} setMapName={setMapName} onSave={() => { if (mapNameError(mapName)) return; void send({ type: 'save_map', name: mapName || undefined }); }} />
          <StatusCard frame={tel.frame} />
          <ToolsCard
            frame={tel.frame}
            canEdit={canEdit}
            toolBusy={toolBusy}
            padLabel={padLabel}
            areaClear={areaClear}
            setAreaClear={setAreaClear}
            imu={imu}
            setImu={setImu}
            drive={drive}
            setDrive={setDrive}
            imuOk={imuOk}
            driveOk={driveOk}
            onRun={(tool, params) => void send({ type: 'run_tool', tool, params })}
            onStop={() => void send({ type: 'stop_tool' })}
            onVision={() => {
              if (now - visionAt < 4000) return;
              setVisionAt(now);
              void send({ type: 'vision', on: !tel.frame?.vision });
            }}
          />
          <WaypointCard seq={tel.frame?.seq ?? null} />
          <CameraCard frame={tel.frame} phase={tel.link.phase} lastAt={tel.lastTelemetryAt} now={now} />
        </div>

        <section className="card" id="console" aria-label="Console">
          <h2>Console — data & events</h2>
          <div className="logbox" tabIndex={0} ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
            {tel.logs.map((ln, i) => (
              <div key={i} className={ln.level === 'tool' ? 'ln ln-tool' : `ln ${ln.level === 'error' || ln.level === 'run' || ln.level === 'info' ? ln.level : 'info'}`}>
                <span className="t">{ln.time}</span>{ln.text}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="toasts" aria-live="polite">{toasts[0] && <div className="toast" role="status">{toasts[0].text}</div>}</div>
      {help && (
        <div className="helpdlg" role="dialog" aria-label="Keyboard shortcuts">
          <h3>Keyboard</h3>
          <p>W A S D or arrows drive. N nav, M no-go, C cancel, +/− zoom, G give, K keep. Space or Esc emergency-stops (not while typing).</p>
          <button type="button" className="btn" onClick={() => setHelp(false)}>Close</button>
        </div>
      )}
    </div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return <div className="ro"><b>{k}</b><span>{v}</span></div>;
}
function fmt(n: number | null | undefined, d: number) {
  return n == null || Number.isNaN(n) ? '–' : n.toFixed(d);
}
function targetEditable(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}
function nudgeFor(key: string): { lin: number; ang: number } | null {
  if (key === 'w' || key === 'W' || key === 'ArrowUp') return { lin: 0.15, ang: 0 };
  if (key === 's' || key === 'S' || key === 'ArrowDown') return { lin: -0.15, ang: 0 };
  if (key === 'a' || key === 'A' || key === 'ArrowLeft') return { lin: 0, ang: 0.6 };
  if (key === 'd' || key === 'D' || key === 'ArrowRight') return { lin: 0, ang: -0.6 };
  return null;
}
function PadButton({ label, glyph, disabled, onDown, onUp }: { label: string; glyph: string; disabled: boolean; onDown: () => void; onUp: () => void }) {
  return <button type="button" aria-label={label} disabled={disabled} onPointerDown={onDown} onPointerUp={onUp} onPointerLeave={onUp}>{glyph}</button>;
}

function AccessBanner(props: {
  flash: 'granted' | 'denied' | 'timeout' | null;
  name: string | null;
  waitingFor: string | null;
  my: { status: string; expiresAt: string | null } | null;
  now: number;
  retryLeft: number;
  pulse: boolean;
  error: boolean;
  offline: boolean;
  onRequest: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const pending = props.my?.status === 'pending';
  const left = secondsRemaining(props.my?.expiresAt, props.now);
  if (props.flash === 'granted') {
    return <div className="banner ok" role="status">You now have control</div>;
  }
  if (pending) {
    return (
      <div className="banner warn" role="status">
        <span className="spin" aria-hidden />
        <div className="fill">
          <div className="waitline">Waiting for {props.waitingFor ?? 'the driver'}… <span className="mono" aria-live="off">{formatCountdown(left)}</span></div>
          <div className="cbar"><i style={{ width: `${countdownFraction(props.my?.expiresAt, props.now) * 100}%` }} /></div>
        </div>
        <button type="button" className="textbtn" onClick={props.onCancel}>Cancel</button>
      </div>
    );
  }
  return (
    <div className={`banner ${props.flash === 'timeout' ? 'warn' : ''}`}>
      <Eye />
      <div className="fill">
        {props.flash === 'timeout' && <div style={{ color: 'var(--warn)' }}>Request timed out</div>}
        {props.flash === 'denied' && <div>{props.name ?? 'They'} kept control.</div>}
        {!props.flash && <div>{props.name ? <>You&apos;re viewing. <b>{props.name}</b> is driving.</> : 'Nobody is driving. Take control?'}</div>}
        {props.error && <p className="err">⚠ {COPY.requestFail} <button type="button" className="link" onClick={props.onRetry}>Try again</button></p>}
      </div>
      <button type="button" className={`btn ${props.pulse && props.retryLeft === 0 && !props.offline ? 'pulse' : ''}`} disabled={props.retryLeft > 0 || props.offline} title={props.offline ? 'Robot is offline' : undefined} aria-disabled={props.retryLeft > 0 || props.offline || undefined} onClick={props.onRequest}>
        {!props.offline && props.retryLeft > 0 ? `Try again in ${props.retryLeft}s` : 'Request control'}
      </button>
    </div>
  );
}

function bar(pct: number, warn: number, crit: number) {
  const color = pct >= crit ? 'var(--err)' : pct >= warn ? 'var(--warn)' : 'var(--ok)';
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} /></div>;
}
function pct(v: number, max: number) { return Math.min(100, Math.round(100 * v / max)); }

function SystemCard({ frame, canEdit, mapName, setMapName, onSave }: { frame: NormState | null; canEdit: boolean; mapName: string; setMapName: (s: string) => void; onSave: () => void }) {
  const s = frame?.sys;
  const has = s && (s.cpu != null || s.temp != null || s.mem || s.disk || s.load != null || s.up || s.throttled);
  return (
    <section className="card" aria-label="System">
      <h2>System</h2>
      {!has && <p className="muted" style={{ textAlign: 'left' }}>No data yet.</p>}
      {has && (
        <div className="sysgrid">
          {s?.cpu != null && <div className="sys"><b>CPU</b><span>{s.cpu}%</span>{bar(s.cpu, 70, 90)}</div>}
          {s?.temp != null && <div className="sys"><b>SoC temp</b><span>{s.temp}°C</span>{bar(pct(s.temp, 90), 67, 84)}</div>}
          {s?.mem && <div className="sys"><b>RAM</b><span>{s.mem[0]} / {s.mem[1]} GB</span>{bar(pct(s.mem[0], s.mem[1] || 1), 75, 90)}</div>}
          {s?.disk && <div className="sys"><b>Disk /</b><span>{s.disk[0]} / {s.disk[1]} GB</span>{bar(pct(s.disk[0], s.disk[1] || 1), 80, 95)}</div>}
          {s?.load != null && <div className="sys"><b>load 1m</b><span>{s.load}</span></div>}
          {s?.up && <div className="sys"><b>uptime</b><span>{s.up}</span></div>}
          {s?.throttled ? <div className="sys" style={{ borderColor: 'var(--err)' }}><b>⚠ PI THROTTLED</b><span style={{ color: 'var(--err)' }}>0x{s.throttled.toString(16)}</span></div> : null}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <div className={`row ${canEdit ? '' : 'locked'}`} aria-disabled={!canEdit}>
          <input className={`mapname${mapNameError(mapName) ? ' bad' : ''}`} aria-label="map name (blank = timestamp)" aria-invalid={mapNameError(mapName) ? true : undefined} aria-describedby={mapNameError(mapName) ? 'map-name-err' : undefined} placeholder="map name (blank = timestamp)" value={mapName} onChange={(e) => setMapName(e.target.value)} />
          <button type="button" className="btn" disabled={!!mapNameError(mapName)} onClick={onSave}>💾 Save map</button>
        </div>
        {mapNameError(mapName) && <p id="map-name-err" className="err" role="alert">{mapNameError(mapName)}</p>}
      </div>
    </section>
  );
}

function StatusCard({ frame }: { frame: NormState | null }) {
  const nodes = frame?.nodes ?? {};
  const keys = [...NODES.filter((n) => n in nodes || Object.keys(nodes).length > 0), ...Object.keys(nodes).filter((n) => !NODES.includes(n) && n !== 'frontier_explorer')];
  const showFrontier = 'frontier_explorer' in nodes;
  const rates = frame?.rates ?? {};
  const topicKeys = [...TOPICS.filter((t) => t in rates), ...Object.keys(rates).filter((t) => !TOPICS.includes(t))];
  const tf = frame?.tf ?? {};
  const empty = !frame || (Object.keys(nodes).length === 0 && Object.keys(rates).length === 0);
  return (
    <section className="card" aria-label="System status">
      <h2>System status</h2>
      {empty && <p className="muted" style={{ textAlign: 'left' }}>No data yet.</p>}
      {!empty && (
        <>
          <div className="nodes">
            {keys.map((n) => <div key={n}><span className={`dot ${nodes[n] ? 'ok' : 'bad'}`} />{n}</div>)}
            {showFrontier && <div><span className={`dot ${nodes.frontier_explorer ? 'ok' : 'bad'}`} />frontier_explorer</div>}
          </div>
          <table style={{ marginTop: 10 }}>
            <tbody>
              {topicKeys.map((t) => (
                <tr key={t}><td>{t}</td><td className="num">{rates[t].hz} Hz</td><td className="num">{rates[t].age == null ? 'never' : `${rates[t].age}s ago`}</td></tr>
              ))}
            </tbody>
          </table>
          <table style={{ marginTop: 6 }}>
            <tbody>
              {Object.entries(tf).map(([k, v]) => (
                <tr key={k}><td><span className={`dot ${v.ok ? 'ok' : 'bad'}`} />TF {k}</td><td className="num">{v.ok ? `age ${v.age}s` : 'MISSING'}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

function ToolsCard(props: {
  frame: NormState | null;
  canEdit: boolean;
  toolBusy: boolean;
  padLabel: 'none' | 'connected' | 'idle';
  areaClear: boolean;
  setAreaClear: (v: boolean) => void;
  imu: { speed: string; rotations: string };
  setImu: (v: { speed: string; rotations: string }) => void;
  drive: { distance: string; maxVel: string };
  setDrive: (v: { distance: string; maxVel: string }) => void;
  imuOk: boolean;
  driveOk: boolean;
  onRun: (tool: string, params?: Record<string, unknown>) => void;
  onStop: () => void;
  onVision: () => void;
}) {
  const lock = props.canEdit ? '' : 'locked';
  return (
    <section className="card" aria-label="Tools">
      <h2>Tools — run on demand only</h2>
      {props.frame?.tool && (
        <div className="running">⏳ {props.frame.tool} running… <button type="button" className="btn stop" style={{ marginLeft: 'auto' }} disabled={!props.canEdit} onClick={props.onStop}>Stop</button></div>
      )}
      <div className={lock} aria-disabled={!props.canEdit}>
        <div className="tool">
          <h3>📐 IMU test</h3>
          <p>Static analysis of /imu — bias, noise, rate. Keep the robot still.</p>
          <button type="button" className="btn" disabled={!props.canEdit || props.toolBusy} onClick={() => props.onRun('imu_test')}>Run test</button>
        </div>
        <div className="tool">
          <h3>🧭 IMU calibration</h3>
          <p>⚠ The robot ROTATES IN PLACE. Clear space around it first.</p>
          <div className="row">
            <label>speed rad/s <input className={props.imuOk ? '' : 'bad'} value={props.imu.speed} onChange={(e) => props.setImu({ ...props.imu, speed: e.target.value })} /></label>
            <label>rotations <input className={props.imuOk ? '' : 'bad'} value={props.imu.rotations} onChange={(e) => props.setImu({ ...props.imu, rotations: e.target.value })} /></label>
            <label><input type="checkbox" checked={props.areaClear} onChange={(e) => props.setAreaClear(e.target.checked)} /> Area is clear</label>
            <button type="button" className="btn" disabled={!props.canEdit || props.toolBusy || !props.imuOk || !props.areaClear} onClick={() => props.onRun('imu_calibration', { speed: props.imu.speed, rotations: props.imu.rotations })}>Calibrate</button>
          </div>
        </div>
        <div className="tool">
          <h3>📏 Drive distance</h3>
          <p>⚠ The robot DRIVES the given distance (negative = backward).</p>
          <div className="row">
            <label>distance m <input className={props.driveOk ? '' : 'bad'} value={props.drive.distance} onChange={(e) => props.setDrive({ ...props.drive, distance: e.target.value })} /></label>
            <label>max vel m/s <input className={props.driveOk ? '' : 'bad'} value={props.drive.maxVel} onChange={(e) => props.setDrive({ ...props.drive, maxVel: e.target.value })} /></label>
            <button type="button" className="btn" disabled={!props.canEdit || props.toolBusy || !props.driveOk || !props.areaClear} onClick={() => props.onRun('drive_distance', { distance: props.drive.distance, max_vel: props.drive.maxVel })}>Drive</button>
          </div>
        </div>
        <div className="tool">
          <h3>🎥 Semantic vision</h3>
          <p>YOLO-World camera detections + LiDAR depth → labelled objects on the map (needs the camera connected). Runs alongside the tools above.</p>
          <button type="button" className={props.frame?.vision ? 'btn stop' : 'btn'} disabled={!props.canEdit} onClick={props.onVision}>{props.frame?.vision ? 'Stop' : 'Start'}</button>
          {props.frame?.yoloText && <p>👁 {props.frame.yoloText}</p>}
        </div>
      </div>
      <p className="help">🎮 Gamepad: <b>B</b> save map · <b>X</b> vision on/off · <b>A</b> waypoint seq start/stop · <b>LT+RT+LB+RB</b> IMU calibration</p>
      <p className="help" style={{ color: props.padLabel === 'connected' ? 'var(--ok)' : 'var(--dim)' }}>
        🎮 {props.padLabel === 'connected' ? 'Gamepad connected' : props.padLabel === 'idle' ? 'Gamepad idle (view only)' : 'No gamepad'}
      </p>
    </section>
  );
}

function WaypointCard({ seq }: { seq: { goals: [number, number][]; idx: number } | null }) {
  const goals = seq?.goals ?? [];
  const idx = seq?.idx ?? -1;
  const running = idx >= 0;
  return (
    <section className="card" aria-label="Waypoint sequence">
      <h2>📍 Waypoint Sequence</h2>
      <div className="seqlist" tabIndex={0}>
        {goals.map((g, i) => (
          <div key={i} className={`sq-item ${i === idx ? 'active' : i < idx && running ? 'done' : ''}`}>
            <span className="sq-num">#{i + 1}</span>
            <span>({g[0].toFixed(2)}, {g[1].toFixed(2)})</span>
          </div>
        ))}
      </div>
      <div className="row locked" aria-disabled="true">
        <input className="sq-in" aria-label="waypoint x" disabled placeholder="x" />
        <input className="sq-in" aria-label="waypoint y" disabled placeholder="y" />
        <button type="button" className="btn" disabled>✚ Add</button>
        <button type="button" className="btn stop" disabled>Clear all</button>
        <button type="button" className="btn" disabled>▶ Start sequence</button>
        <button type="button" className="btn stop" disabled>■ Stop</button>
      </div>
      <p className="help" style={{ color: running ? 'var(--ok)' : 'var(--dim)' }}>
        {running ? `▶ Running goal ${idx + 1} / ${goals.length}` : goals.length ? `Idle · ${goals.length} waypoint(s)` : 'No waypoints'}
      </p>
      <p className="help">Waypoint sequences aren&apos;t available remotely yet.</p>
    </section>
  );
}

function CameraCard({ frame, phase, lastAt, now }: { frame: NormState | null; phase: LinkPhase; lastAt: number | null; now: number }) {
  const src = phase === 'live' && frame?.vision && frame.camera
    ? (frame.camera.startsWith('data:') ? frame.camera : `data:image/jpeg;base64,${frame.camera}`)
    : null;
  const age = lastAt == null ? null : (now - lastAt) / 1000;
  const copy = phase === 'live' && frame?.vision && !src
    ? 'Waiting for camera…'
    : phase === 'live' && !frame?.vision
      ? 'Vision off — start vision to see camera feed'
      : phase === 'connecting' || phase === 'live'
        ? 'Waiting for camera…'
        : 'Camera unavailable until the robot is live';
  return (
    <section className="card" aria-label="Camera feed">
      <h2>📷 Camera feed</h2>
      {src ? (
        <div className="camwrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="cam" alt="Robot camera" src={src} />
          <span className="camchip">{age != null && age > 3 ? `last frame ${age.toFixed(0)}s ago` : 'LIVE · ~1 fps'}</span>
        </div>
      ) : (
        <p className="muted">{copy}</p>
      )}
    </section>
  );
}

function Sign({ id, on, label, detail }: { id: StatusSignId; on: boolean; label: string; detail?: string | null }) {
  return (
    <span className={`op-sign sign-${id}`} data-on={on ? 'true' : 'false'} aria-current={on ? 'true' : undefined}>
      <SignMark id={id} />
      <span>{label}</span>
      {on && detail && <span className="reason">{detail}</span>}
    </span>
  );
}

function SignMark({ id }: { id: StatusSignId }) {
  if (id === 'nodata') return <span className="sign-half" aria-hidden />;
  if (id === 'down') return <span className="sign-hollow" aria-hidden />;
  return (
    <svg className="sign-x" viewBox="0 0 12 12" aria-hidden>
      <path d="M2 2 L10 10 M10 2 L2 10" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function LinkStatus({ phase, label, highLag }: { phase: LinkPhase; label: string; highLag: boolean }) {
  return (
    <span className={`pill link ${phase}`} role="status" aria-live="polite" aria-atomic="true">
      <StatusMark phase={phase} />
      {label}
      {highLag && <span className="sr-only"> Slow connection</span>}
    </span>
  );
}

function StatusMark({ phase }: { phase: LinkPhase }) {
  if (phase === 'connecting') return <span className="status-ring" aria-hidden />;
  if (phase === 'idle') return <span className="status-idle" aria-hidden />;
  if (phase === 'live') return <span className="status-live" aria-hidden />;
  return <span className="status-off" aria-hidden />;
}

function readGamepad(): { a: number[]; b: number } | null {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads).find((p) => p && (p.mapping === 'standard' || p.axes.length >= 4));
  if (!pad) return null;
  const ax = (i: number) => pad.axes[i] ?? 0;
  const btn = (i: number) => pad.buttons[i];
  const dead = (n: number) => Math.abs(n) < 0.08 ? 0 : n;
  const a = [
    dead(-ax(0)), dead(-ax(1)), dead(-ax(2)), ax(3),
    btn(6)?.value ?? 0, btn(7)?.value ?? 0,
    (btn(15)?.pressed ? -1 : 0) + (btn(14)?.pressed ? 1 : 0),
    (btn(12)?.pressed ? 1 : 0) + (btn(13)?.pressed ? -1 : 0),
  ].map((n) => Math.round(n * 1000) / 1000);
  let bits = 0;
  const map: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [8, 6], [9, 7], [16, 8], [10, 9], [11, 10]];
  for (const [idx, bit] of map) if (btn(idx)?.pressed) bits |= 1 << bit;
  return { a, b: bits };
}

function Eye() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function Wheel() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M12 3v7M12 14v7M3 12h7M14 12h7" /></svg>;
}
