'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAuth } from '@/lib/useAuth';
import { readConfig } from '@/lib/config';
import { asset } from '@/lib/asset';
import { getAuthClient, getBroadcastClient } from '@/services/supabase-client';
import { BOTS, type BotId } from '@/lib/telemetry/protocol';
import { JOY_HZ } from '@/lib/telemetry/commands';
import { persistBot, readStoredBot, isBotId } from '@/lib/control/bot-persist';
import { useControlSession } from '@/lib/telemetry/useControlSession';
import { WaveLines } from '@/components/effects/WaveLines';
import { XboxController, readPhysicalGamepad, type JoyReading } from './XboxController';
import '@/components/effects/effects.css';
import './dashboard.css';

/** Standalone mobile/complete-control window opened from the control panel. */
export function PadPage() {
  const { session, signOut } = useAuth();
  const cfg = readConfig();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [broadcastClient, setBroadcastClient] = useState<SupabaseClient | null>(null);
  const [botId, setBotId] = useState<BotId>(() => {
    if (typeof window === 'undefined') return 'hardware-bot';
    const q = new URLSearchParams(window.location.search).get('bot');
    return isBotId(q) ? q : readStoredBot('hardware-bot');
  });
  const userId = session?.userId ?? null;
  const tel = useControlSession(client, userId, botId, broadcastClient);
  const [padLabel, setPadLabel] = useState<'none' | 'connected' | 'idle'>('none');
  const [physicalPad, setPhysicalPad] = useState<JoyReading | null>(null);
  const virtualPadRef = useRef<JoyReading | null>(null);
  const joined = useRef(false);

  useEffect(() => { persistBot(botId); }, [botId]);

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

  const controller = tel.role === 'controller';
  const robotLive = tel.link.phase === 'live';
  const canEdit = controller && robotLive && !tel.heartbeatStale && !tel.realtimeDown;
  const bot = BOTS.find((b) => b.id === botId)!;
  const sendRef = useRef(tel.sendCommand);
  const padRef = useRef(padLabel);
  useEffect(() => { sendRef.current = tel.sendCommand; });

  useEffect(() => {
    if (joined.current || tel.joining || !tel.role) return;
    joined.current = true;
  }, [tel.joining, tel.role]);

  useEffect(() => {
    let timer = 0;
    let alive = true;
    const tick = () => {
      timer = window.setTimeout(tick, 1000 / JOY_HZ);
      if (!alive) return;
      const physical = readPhysicalGamepad();
      setPhysicalPad(physical);
      const reading = virtualPadRef.current ?? physical;
      const next = !physical && !virtualPadRef.current
        ? 'none'
        : (!controller || document.hidden ? 'idle' : 'connected');
      if (padRef.current !== next) { padRef.current = next; setPadLabel(next); }
      if (!reading || !controller || document.hidden || !canEdit) return;
      void sendRef.current({ type: 'joy', a: reading.a, b: reading.b });
    };
    timer = window.setTimeout(tick, 1000 / JOY_HZ);
    const stop = () => { if (controller) void sendRef.current({ type: 'joy', a: [0, 0, 0, 0, 0, 0, 0, 0], b: 0 }); };
    window.addEventListener('blur', stop);
    return () => { alive = false; window.clearTimeout(timer); window.removeEventListener('blur', stop); stop(); };
  }, [controller, canEdit]);

  const fireEstop = useCallback(() => {
    if (!controller) return;
    void tel.sendCommand({ type: 'estop' });
  }, [controller, tel]);

  return (
    <div className="op op-pad-page">
      <div className="op-bg" aria-hidden><WaveLines lines={4} /></div>
      <header className="op-header op-pad-head">
        <a className="op-home" href={asset('/control/')} title="Back to control panel">← Panel</a>
        <h1>
          <span className="op-brand">AMR</span>
          <span className="op-bot-label">{bot.label}</span>
        </h1>
        <div className="op-switch" role="group" aria-label="Bot">
          {BOTS.map((b) => (
            <button key={b.id} type="button" aria-pressed={b.id === botId} onClick={() => { setBotId(b.id); joined.current = false; }}>{b.label}</button>
          ))}
        </div>
        <div className="op-grow">
          {controller ? (
            <span className="pill ok">In control</span>
          ) : (
            <button type="button" className="btn" disabled={tel.joining || !!tel.myRequest} onClick={() => void tel.requestControl()}>
              {tel.myRequest ? 'Waiting…' : 'Take control'}
            </button>
          )}
          {controller && (
            <button type="button" className="op-estop" onClick={fireEstop}>E-STOP</button>
          )}
          <button type="button" className="btn ghost" onClick={() => { void signOut().then(() => window.location.replace(asset('/sign-in/'))); }}>Sign out</button>
        </div>
      </header>
      <p className="op-pad-note">
        {tel.link.phase === 'offline' ? `${bot.label} offline` : tel.link.label}
        {' · '}
        Mobile complete control — keep this window open while driving
      </p>
      <XboxController
        open
        variant="page"
        canEdit={canEdit}
        padLabel={padLabel}
        physical={physicalPad}
        virtualRef={virtualPadRef}
      />
    </div>
  );
}
