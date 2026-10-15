'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  BOTS,
  type BotId,
  type BotTelemetry,
  type CommandEnvelope,
  type ControlCommand,
  type ControlLockPresence,
  type HeartbeatMsg,
  type MapFrame,
  channelName,
  isBotOffline,
  nextLagMs,
  preferBoardMode,
} from './protocol';
import { attachControlLock, fetchOperatorProfile, type ControlLockApi, type OperatorProfile } from './authority';

export type LinkStatus = 'connecting' | 'online' | 'degraded' | 'offline';

export interface TelemetryView {
  botId: BotId;
  status: LinkStatus;
  /** Effective UI mode after lag fallback. */
  viewMode: 'full' | 'board';
  lagMs: number;
  lastTs: number | null;
  frame: BotTelemetry | null;
  map: MapFrame | null;
  controller: ControlLockPresence | null;
  iAmController: boolean;
  profile: OperatorProfile | null;
  sendCommand: (cmd: ControlCommand) => Promise<boolean>;
  requestControl: () => Promise<boolean>;
  releaseControl: () => Promise<void>;
  setBotId: (id: BotId) => void;
  bots: typeof BOTS;
}

function linkStatus(online: boolean, viewMode: 'full' | 'board', lastTs: number | null): LinkStatus {
  if (!online || isBotOffline(lastTs)) return 'offline';
  if (viewMode === 'board') return 'degraded';
  return 'online';
}

export function useBotTelemetry(
  client: SupabaseClient | null,
  user: { id: string; email?: string } | null,
  initialBot: BotId = 'amr4',
): TelemetryView {
  const [botId, setBotIdState] = useState<BotId>(initialBot);
  const [frame, setFrame] = useState<BotTelemetry | null>(null);
  const [map, setMap] = useState<MapFrame | null>(null);
  const [lastTs, setLastTs] = useState<number | null>(null);
  const [lagMs, setLagMs] = useState(0);
  const [viewMode, setViewMode] = useState<'full' | 'board'>('full');
  const [controller, setController] = useState<ControlLockPresence | null>(null);
  const [profile, setProfile] = useState<OperatorProfile | null>(null);

  const lagRef = useRef(0);
  const boardRef = useRef(false);
  const lastArriveRef = useRef(0);
  const lockRef = useRef<ControlLockApi | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const profileRef = useRef<OperatorProfile | null>(null);
  const viewModeRef = useRef<'full' | 'board'>('full');

  const activeProfile = client && user ? profile : null;

  useEffect(() => {
    if (!client || !user) return;
    let live = true;
    fetchOperatorProfile(client, user.id).then((p) => {
      if (!live) return;
      const withEmail = { ...p, email: p.email ?? user.email };
      profileRef.current = withEmail;
      setProfile(withEmail);
    });
    return () => { live = false; };
  }, [client, user]);

  useEffect(() => {
    if (!client || !activeProfile) return;
    let cancelled = false;

    const lock = attachControlLock(client, botId, activeProfile);
    lockRef.current = lock;
    const unLock = lock.subscribe((c) => { if (!cancelled) setController(c); });

    const ch = client.channel(channelName(botId));
    channelRef.current = ch;

    ch.on('broadcast', { event: 'telemetry' }, ({ payload }) => {
      const tel = payload as BotTelemetry;
      if (!tel || tel.botId !== botId) return;
      const now = Date.now();
      const prev = lastArriveRef.current;
      lastArriveRef.current = now;
      if (prev > 0) {
        const expected = tel.mode === 'board' ? 1000 : 100;
        const inter = Math.max(0, (now - prev) - expected);
        lagRef.current = nextLagMs(lagRef.current, inter + Math.max(0, now - tel.ts));
        const board = preferBoardMode(lagRef.current, boardRef.current);
        boardRef.current = board;
        const nextMode = board ? 'board' : 'full';
        viewModeRef.current = nextMode;
        setLagMs(lagRef.current);
        setViewMode(nextMode);
      }
      setLastTs(tel.ts);
      setFrame(tel);
    });

    ch.on('broadcast', { event: 'map' }, ({ payload }) => {
      const m = payload as MapFrame;
      if (m?.botId === botId) setMap(m);
    });

    ch.on('broadcast', { event: 'hb' }, ({ payload }) => {
      const hb = payload as HeartbeatMsg;
      if (hb?.botId === botId) setLastTs(hb.ts);
    });

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && !cancelled) {
        await ch.send({
          type: 'broadcast',
          event: 'command',
          payload: {
            id: crypto.randomUUID(),
            botId,
            ts: Date.now(),
            from: { userId: activeProfile.userId, email: activeProfile.email, rank: activeProfile.rank },
            cmd: { type: 'set_rate', mode: boardRef.current ? 'board' : 'full' },
          } satisfies CommandEnvelope,
        });
      }
    });

    const tick = window.setInterval(() => {
      setLagMs(lagRef.current);
      setViewMode(boardRef.current ? 'board' : 'full');
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
      unLock();
      void lock.destroy();
      lockRef.current = null;
      void client.removeChannel(ch);
      channelRef.current = null;
    };
  }, [client, botId, activeProfile]);

  useEffect(() => {
    const ch = channelRef.current;
    const p = profileRef.current;
    if (!ch || !p) return;
    void ch.send({
      type: 'broadcast',
      event: 'command',
      payload: {
        id: crypto.randomUUID(),
        botId,
        ts: Date.now(),
        from: { userId: p.userId, email: p.email, rank: p.rank },
        cmd: { type: 'set_rate', mode: viewMode },
      } satisfies CommandEnvelope,
    });
  }, [viewMode, botId]);

  const sendCommand = useCallback(async (cmd: ControlCommand) => {
    const ch = channelRef.current;
    const p = profileRef.current;
    const lock = lockRef.current;
    if (!ch || !p) return false;
    if (cmd.type !== 'estop') {
      const c = lock?.getController();
      if (!c || c.userId !== p.userId) return false;
    } else if (p.rank < 1) {
      return false;
    }
    const env: CommandEnvelope = {
      id: crypto.randomUUID(),
      botId,
      ts: Date.now(),
      from: { userId: p.userId, email: p.email, rank: p.rank },
      cmd,
    };
    const res = await ch.send({ type: 'broadcast', event: 'command', payload: env });
    return res === 'ok';
  }, [botId]);

  const requestControl = useCallback(async () => {
    return (await lockRef.current?.requestControl()) ?? false;
  }, []);

  const releaseControl = useCallback(async () => {
    await lockRef.current?.releaseControl();
  }, []);

  const setBotId = useCallback((id: BotId) => {
    lagRef.current = 0;
    boardRef.current = false;
    lastArriveRef.current = 0;
    viewModeRef.current = 'full';
    setFrame(null);
    setMap(null);
    setLastTs(null);
    setController(null);
    setLagMs(0);
    setViewMode('full');
    setBotIdState(id);
  }, []);

  const online = !isBotOffline(lastTs);
  const status = client && user
    ? (lastTs == null && !frame ? 'connecting' : linkStatus(online, viewMode, lastTs))
    : 'offline';

  return {
    botId,
    status,
    viewMode,
    lagMs,
    lastTs,
    frame,
    map,
    controller,
    iAmController: !!(activeProfile && controller?.userId === activeProfile.userId),
    profile: activeProfile,
    sendCommand,
    requestControl,
    releaseControl,
    setBotId,
    bots: BOTS,
  };
}
