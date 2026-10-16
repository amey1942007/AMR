'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  BOTS,
  type BotId,
  type BotTelemetry,
  type CommandEnvelope,
  type ConsoleLogLine,
  type ControlCommand,
  type ControlLockPresence,
  type HeartbeatMsg,
  type MapFrame,
  channelName,
  nextLagMs,
  preferBoardMode,
} from './protocol';
import { attachControlLock, fetchOperatorProfile, type ControlLockApi, type OperatorProfile } from './authority';
import {
  connectingLink,
  deriveLinkStatus,
  isPrivateControlEnabled,
  offlineLink,
  parseLastSeenAt,
  type LinkPhase,
  type LinkStatusView,
} from './link-status';

export type LinkStatus = LinkPhase;

const MAX_LOGS = 400;

export interface TelemetryView {
  botId: BotId;
  status: LinkStatus;
  /** Effective UI mode after lag fallback. */
  viewMode: 'full' | 'board';
  lagMs: number;
  lastTs: number | null;
  /** Phase, stable label, and whether the lag readout should show. */
  link: LinkStatusView;
  frame: BotTelemetry | null;
  map: MapFrame | null;
  logs: ConsoleLogLine[];
  controller: ControlLockPresence | null;
  iAmController: boolean;
  profile: OperatorProfile | null;
  sendCommand: (cmd: ControlCommand) => Promise<boolean>;
  requestControl: () => Promise<boolean>;
  releaseControl: () => Promise<void>;
  setBotId: (id: BotId) => void;
  bots: typeof BOTS;
}

interface LastSeenState {
  settled: boolean;
  readable: boolean;
  at: number | null;
}

const LAST_SEEN_EMPTY: LastSeenState = { settled: false, readable: false, at: null };

export function useBotTelemetry(
  client: SupabaseClient | null,
  user: { id: string; email?: string } | null,
  initialBot: BotId = 'amr4',
): TelemetryView {
  const [botId, setBotIdState] = useState<BotId>(initialBot);
  const [frame, setFrame] = useState<BotTelemetry | null>(null);
  const [map, setMap] = useState<MapFrame | null>(null);
  const [logs, setLogs] = useState<ConsoleLogLine[]>([]);
  const [heartbeatTs, setHeartbeatTs] = useState<number | null>(null);
  const [telemetryTs, setTelemetryTs] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<LastSeenState>(LAST_SEEN_EMPTY);
  const [subscribedAt, setSubscribedAt] = useState<number | null>(null);
  const [channelFailed, setChannelFailed] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
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
  const privateChannel = isPrivateControlEnabled(process.env.NEXT_PUBLIC_PRIVATE_CONTROL);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);

  // Signed-in read of amr_bots.last_seen_at. Anon is filtered by RLS and must
  // not be treated as a fresh heartbeat (readable stays false on error).
  useEffect(() => {
    if (!client || !user) return;
    let cancelled = false;
    const requested = botId;
    const read = async () => {
      const { data, error } = await client
        .from('amr_bots')
        .select('last_seen_at')
        .eq('id', requested)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setLastSeen({ settled: true, readable: false, at: null });
        return;
      }
      const row = data as { last_seen_at?: string | null } | null;
      setLastSeen({
        settled: true,
        readable: true,
        at: parseLastSeenAt(row?.last_seen_at ?? null),
      });
    };
    void read();
    const id = window.setInterval(() => { void read(); }, 3_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [client, user, botId]);

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

    const lock = attachControlLock(client, botId, activeProfile, { privateChannel });
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
      setTelemetryTs(Number.isFinite(tel.ts) ? tel.ts : Date.now());
      setFrame(tel);
    });

    ch.on('broadcast', { event: 'map' }, ({ payload }) => {
      const m = payload as MapFrame;
      if (m?.botId === botId) setMap(m);
    });

    ch.on('broadcast', { event: 'log' }, ({ payload }) => {
      const line = payload as ConsoleLogLine & { botId?: BotId };
      if (!line || (line.botId != null && line.botId !== botId)) return;
      setLogs((prev) => {
        const next = [...prev, {
          time: line.time || new Date().toTimeString().slice(0, 8),
          level: line.level || 'info',
          text: line.text || '',
          ts: line.ts,
        }];
        return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
      });
    });

    ch.on('broadcast', { event: 'hb' }, ({ payload }) => {
      const hb = payload as HeartbeatMsg;
      if (!hb || (hb.botId != null && hb.botId !== botId)) return;
      if (Number.isFinite(hb.ts)) setHeartbeatTs(hb.ts);
    });

    ch.subscribe(async (status) => {
      if (cancelled) return;
      if (status === 'SUBSCRIBED') {
        setChannelFailed(false);
        setSubscribedAt((prev) => prev ?? Date.now());
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
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setChannelFailed(true);
      }
    });

    return () => {
      cancelled = true;
      setSubscribedAt(null);
      setChannelFailed(false);
      unLock();
      void lock.destroy();
      lockRef.current = null;
      void client.removeChannel(ch);
      channelRef.current = null;
    };
  }, [client, botId, activeProfile, privateChannel]);

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
    setLogs([]);
    setHeartbeatTs(null);
    setTelemetryTs(null);
    setLastSeen(LAST_SEEN_EMPTY);
    setSubscribedAt(null);
    setChannelFailed(false);
    setStartedAt(Date.now());
    setController(null);
    setLagMs(0);
    setViewMode('full');
    setBotIdState(id);
  }, []);

  const lastTs = [heartbeatTs, telemetryTs].reduce<number | null>((latest, ts) => {
    if (ts == null || !Number.isFinite(ts)) return latest;
    return latest == null || ts > latest ? ts : latest;
  }, null);
  const link = !client
    ? offlineLink()
    : !user
      ? connectingLink()
      : deriveLinkStatus({
        now,
        startedAt,
        subscribedAt,
        channelFailed,
        lastSeenSettled: lastSeen.settled,
        lastSeenReadable: lastSeen.readable,
        lastSeenAtMs: lastSeen.at,
        heartbeatTs,
        telemetryTs,
      });

  return {
    botId,
    status: link.phase,
    viewMode,
    lagMs,
    lastTs,
    link,
    frame,
    map,
    logs,
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
