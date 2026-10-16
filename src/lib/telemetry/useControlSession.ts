'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  HEARTBEAT_MS,
  PENDING_POLL_MS,
  ACK_TIMEOUT_MS,
  alignedNow,
  cmdChannelConfig,
  commandDelivery,
  createSeqCounter,
  estopRpcFallback,
  parseCmdAck,
  privateCmdPayload,
  privateCommandRoute,
  publicCommandEnvelope,
  serverOffsetFromLease,
  shouldFastPoll,
  type CmdAck,
  type CommandResult,
} from './commands';
import {
  authEventRefreshesRealtime,
  emptyChannelMembership,
  formatChannelDetail,
  interpretChannelStatus,
  LINK_RETRY_BASE_MS,
  linkRetryAction,
  openChannel,
  retireChannels,
} from './channel-watch';
import { controlListenPlan, privateControlEnabled, privateListenTopics, shouldHoldCmdChannel, type CmdJoinEvent } from './channels';
import {
  connectingLink,
  deriveLinkStatus,
  LAST_SEEN_SAMPLE,
  nextPollDelay,
  noteLastSeenFailure,
  noteLastSeenRead,
  type LastSeenSample,
  type LinkStatusView,
} from './link-status';
import { nextLagMs, preferBoardMode, type BotId, type ConsoleLogLine, type ControlCommand, type MapFrame } from './protocol';
import { holdScan, normalizeMap, normalizeTelemetry, type NormState } from './normalize';
import { deriveStatusSigns, shortCommandReason, type StatusSignView } from './status-signs';
import {
  parseHeartbeat,
  respondFailure,
  type HeartbeatView,
  type MyRequest,
  type PendingRequest,
} from '@/lib/control/access';

const MAX_LOGS = 500;

export interface ControlSession {
  privateControl: boolean;
  role: 'controller' | 'viewer' | null;
  joining: boolean;
  epoch: number;
  controllerId: string | null;
  controllerName: string | null;
  pendingRequests: PendingRequest[];
  myRequest: MyRequest | null;
  retryAfter: number | null;
  requestError: string | null;
  /** Last join/heartbeat RPC error. Null after a successful heartbeat. */
  heartbeatError: string | null;
  heartbeatStale: boolean;
  realtimeDown: boolean;
  frame: NormState | null;
  map: MapFrame | null;
  logs: ConsoleLogLine[];
  /** Local time the latest telemetry broadcast arrived. Heartbeats do not update this. */
  lastTelemetryAt: number | null;
  /** Connecting / online-no-data / live / offline. Freshness is local receipt time. */
  link: LinkStatusView;
  /** Smoothed inter-arrival of telemetry receipts. Shown only while live. */
  lagMs: number;
  /** True after lag crosses the fallback threshold, until it recovers. */
  slowLink: boolean;
  /** Connected / not connected / error. The error sign carries a short reason. */
  signs: StatusSignView;
  /** Muted note when ctl/notify fails and the data channel is still up. Not an error. */
  channelNote: string | null;
  names: Record<string, string>;
  pushLog: (level: string, text: string) => void;
  sendCommand: (cmd: ControlCommand) => Promise<CommandResult>;
  requestControl: () => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  respond: (id: string, accept: boolean) => Promise<{ kind: 'ok' | 'ended' | 'left' | 'lost' | 'retry'; name?: string }>;
  refresh: () => Promise<void>;
}

export function useControlSession(
  client: SupabaseClient | null,
  userId: string | null,
  botId: BotId,
  /** Public `amr-bot-*` socket. Must not be the signed-in auth client. */
  broadcastClient: SupabaseClient | null = null,
): ControlSession {
  const privateControl = privateControlEnabled();
  const [role, setRole] = useState<'controller' | 'viewer' | null>(null);
  const [joining, setJoining] = useState(true);
  const [joinedBot, setJoinedBot] = useState(botId);
  const joiningView = client && userId ? joining : false;
  const [epoch, setEpoch] = useState(0);
  const [controllerId, setControllerId] = useState<string | null>(null);
  const [controllerName, setControllerName] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [myRequest, setMyRequest] = useState<MyRequest | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [heartbeatError, setHeartbeatError] = useState<string | null>(null);
  const [heartbeatAt, setHeartbeatAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [realtimeDown, setRealtimeDown] = useState(false);
  const [frame, setFrame] = useState<NormState | null>(null);
  const [map, setMap] = useState<MapFrame | null>(null);
  const [logs, setLogs] = useState<ConsoleLogLine[]>([]);
  const [lastTelemetryAt, setLastTelemetryAt] = useState<number | null>(null);
  const [heartbeatReceivedAt, setHeartbeatReceivedAt] = useState<number | null>(null);
  const [telemetryReceivedAt, setTelemetryReceivedAt] = useState<number | null>(null);
  const [lastSeen, setLastSeen] = useState<LastSeenSample>(LAST_SEEN_SAMPLE);
  const [subscribedAt, setSubscribedAt] = useState<number | null>(null);
  const [channelFailed, setChannelFailed] = useState(false);
  const [channelDetail, setChannelDetail] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [lagMs, setLagMs] = useState(0);
  const [slowLink, setSlowLink] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [telemetryUnreadable, setTelemetryUnreadable] = useState(false);
  const [channelNote, setChannelNote] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  const tokenRef = useRef<string | null>(null);
  const epochRef = useRef(0);
  const roleRef = useRef<'controller' | 'viewer' | null>(null);
  const seqRef = useRef(createSeqCounter());
  const pollRef = useRef({ my: null as string | null, incoming: 0 });
  const cmdChRef = useRef<RealtimeChannel | null>(null);
  const cmdSubscribedRef = useRef(false);
  const joinCmdRef = useRef<() => void>(() => {});
  const leaveCmdRef = useRef<() => void>(() => {});
  const offsetRef = useRef<number | null>(null);
  const publicChRef = useRef<RealtimeChannel | null>(null);
  const ackWaiters = useRef(new Map<number, (ack: CmdAck) => void>());
  const lagRef = useRef(0);
  const lastArriveRef = useRef(0);
  const slowRef = useRef(false);

  if (botId !== joinedBot) {
    setJoinedBot(botId);
    setJoining(true);
    setFrame(null);
    setMap(null);
    setLastTelemetryAt(null);
    setHeartbeatReceivedAt(null);
    setTelemetryReceivedAt(null);
    setLastSeen(LAST_SEEN_SAMPLE);
    setSubscribedAt(null);
    setChannelFailed(false);
    setChannelDetail(null);
    setStartedAt(Number.POSITIVE_INFINITY);
    setLagMs(0);
    setSlowLink(false);
    setRealtimeDown(false);
    setCommandError(null);
    setTelemetryUnreadable(false);
    setChannelNote(null);
  }

  const syncCmd = useCallback((event: CmdJoinEvent, role: 'controller' | 'viewer' | null) => {
    if (!privateControl) return;
    if (shouldHoldCmdChannel(event, role)) joinCmdRef.current();
    else leaveCmdRef.current();
  }, [privateControl]);

  const pushLog = useCallback((level: string, text: string) => {
    const line: ConsoleLogLine = {
      time: new Date().toTimeString().slice(0, 8),
      level,
      text: text.replace(/token["']?\s*[:=]\s*["'][^"']+["']/gi, 'token [redacted]'),
    };
    setLogs((prev) => {
      const next = [...prev, line];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  const apply = useCallback((raw: unknown, event: CmdJoinEvent = 'heartbeat') => {
    const view = parseHeartbeat(raw);
    if (!view) return;
    if (view.role === 'controller') {
      const off = serverOffsetFromLease(view.leaseExpiresAt, Date.now());
      if (off != null) offsetRef.current = off;
    }
    syncCmd(event, view.role);
    roleRef.current = view.role;
    epochRef.current = view.epoch;
    tokenRef.current = view.role === 'controller' ? view.token : null;
    if (view.role !== 'controller') tokenRef.current = null;
    pollRef.current = {
      my: view.myRequest?.status ?? null,
      incoming: view.role === 'controller' ? view.pendingRequests.length : 0,
    };
    setRole(view.role);
    setEpoch(view.epoch);
    setControllerId(view.controller);
    setControllerName(view.controllerName);
    setPendingRequests(view.role === 'controller' ? view.pendingRequests : []);
    setMyRequest(view.myRequest);
    setRetryAfter(view.retryAfter);
    setHeartbeatAt(Date.now());
    setJoining(false);
    setHeartbeatError(null);
  }, [syncCmd]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!client || !userId) return;
    let live = true;
    const load = () => {
      void client.rpc('operator_names').then(({ data }) => {
        if (!live || !Array.isArray(data)) return;
        const next: Record<string, string> = {};
        for (const row of data) {
          if (row && typeof row === 'object' && typeof (row as { user_id?: string }).user_id === 'string') {
            const r = row as { user_id: string; display_name?: string };
            next[r.user_id] = r.display_name || 'Operator';
          }
        }
        setNames(next);
      });
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => { live = false; window.clearInterval(id); };
  }, [client, userId]);

  // Signed-in read of amr_bots.last_seen_at. One request at a time. A single
  // error keeps the last good row; the second consecutive failure is unreadable
  // and the next try waits 12s. Anon is filtered by RLS (no error, empty row).
  useEffect(() => {
    if (!client || !userId) return;
    let cancelled = false;
    let timer = 0;
    let inFlight = false;
    let sample = LAST_SEEN_SAMPLE;
    const requested = botId;

    const schedule = (delay: number) => {
      timer = window.setTimeout(() => { void read(); }, delay);
    };

    const read = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const { data, error } = await client
          .from('amr_bots')
          .select('last_seen_at')
          .eq('id', requested)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          sample = noteLastSeenFailure(sample);
          setLastSeen(sample);
          schedule(nextPollDelay(sample.failures));
          return;
        }
        const row = data as { last_seen_at?: string | null } | null;
        sample = noteLastSeenRead(sample, row?.last_seen_at ?? null, Date.now());
        setLastSeen(sample);
        schedule(nextPollDelay(0));
      } catch {
        if (cancelled) return;
        sample = noteLastSeenFailure(sample);
        setLastSeen(sample);
        schedule(nextPollDelay(sample.failures));
      } finally {
        inFlight = false;
      }
    };

    void read();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, userId, botId]);

  useEffect(() => {
    if (!client || !userId) return;
    let cancelled = false;
    const bot = botId;
    const beat = async () => {
      const { data, error } = await client.rpc('bot_heartbeat', { p_bot: bot });
      if (cancelled) return;
      if (error) {
        setHeartbeatError(error.message || 'Heartbeat failed');
        return;
      }
      apply(data, 'heartbeat');
    };
    void (async () => {
      const joined = await client.rpc('join_bot', { p_bot: bot });
      if (cancelled) return;
      if (joined.error) {
        setRequestError('join');
        setHeartbeatError(joined.error.message || 'Could not join the bot');
      } else apply(joined.data, 'join_bot');
      await beat();
    })();
    let timer = 0;
    const arm = () => {
      const fast = shouldFastPoll({ myStatus: pollRef.current.my, incoming: pollRef.current.incoming });
      timer = window.setTimeout(() => { void beat().finally(() => { if (!cancelled) arm(); }); }, fast ? PENDING_POLL_MS : HEARTBEAT_MS);
    };
    arm();
    const leave = () => { void client.rpc('leave_bot', { p_bot: bot }); };
    window.addEventListener('pagehide', leave);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [client, userId, botId, apply]);

  useEffect(() => {
    const socket = privateControl ? client : broadcastClient;
    if (!client || !userId || !socket) return;
    lagRef.current = 0;
    lastArriveRef.current = 0;
    slowRef.current = false;
    const stamp = window.setTimeout(() => setStartedAt(Date.now()), 0);
    let cancelled = false;
    let delay = LINK_RETRY_BASE_MS;
    let retryTimer = 0;
    let membership = emptyChannelMembership();
    let nextChannelId = 1;
    const channels: RealtimeChannel[] = [];
    const channelIds = new Map<RealtimeChannel, number>();
    const sideRetry = new Map<string, number>();
    const track = (ch: RealtimeChannel) => { channels.push(ch); return ch; };
    const topics = privateListenTopics(botId, userId);

    let unsubscribeAuth = () => {};
    if (privateControl) {
      const { data: authWatch } = client.auth.onAuthStateChange((event, session) => {
        if (cancelled || !authEventRefreshesRealtime(event)) return;
        const access = session?.access_token;
        if (!access) return;
        void client.realtime.setAuth(access);
      });
      unsubscribeAuth = () => authWatch.subscription.unsubscribe();
    }

    const clearSideRetries = () => {
      for (const timer of sideRetry.values()) window.clearTimeout(timer);
      sideRetry.clear();
    };

    const onTelemetry = ({ payload }: { payload: unknown }) => {
      const n = normalizeTelemetry(payload);
      if (!n) {
        if (payload && typeof payload === 'object') {
          const kind = (payload as { t?: unknown }).t;
          if (kind !== 'map' && kind !== 'log' && kind !== 'hb') setTelemetryUnreadable(true);
        }
        return;
      }
      setTelemetryUnreadable(false);
      setFrame((prev) => holdScan(prev, n, payload));
      const received = Date.now();
      const prev = lastArriveRef.current;
      lastArriveRef.current = received;
      if (prev > 0) {
        lagRef.current = nextLagMs(lagRef.current, Math.max(0, received - prev));
        setLagMs(lagRef.current);
        const slow = preferBoardMode(lagRef.current, slowRef.current);
        if (slow !== slowRef.current) {
          slowRef.current = slow;
          setSlowLink(slow);
        }
      }
      setTelemetryReceivedAt(received);
      setLastTelemetryAt(received);
    };
    const onMap = ({ payload }: { payload: unknown }) => {
      const m = normalizeMap(payload);
      if (m) setMap(m);
    };
    const onLog = ({ payload }: { payload: unknown }) => {
      if (!payload || typeof payload !== 'object') return;
      const p = payload as { time?: string; level?: string; text?: string; botId?: string };
      if (p.botId && p.botId !== botId) return;
      setLogs((prev) => {
        const next = [...prev, { time: p.time || new Date().toTimeString().slice(0, 8), level: p.level || 'info', text: String(p.text ?? '') }];
        return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
      });
    };
    const onHb = () => setHeartbeatReceivedAt(Date.now());

    const noteBeat = (error: { message?: string } | null, data: unknown, event: CmdJoinEvent) => {
      if (cancelled) return;
      if (error) { setHeartbeatError(error.message || 'Heartbeat failed'); return; }
      apply(data, event);
    };

    const leaveCmd = () => {
      cmdSubscribedRef.current = false;
      const ch = cmdChRef.current;
      cmdChRef.current = null;
      if (ch) void client.removeChannel(ch);
    };

    const joinCmd = () => {
      if (cancelled || !privateControl || cmdChRef.current) return;
      const topic = `bot:${botId}:cmd`;
      const cmd = client.channel(topic, { config: cmdChannelConfig() });
      cmdChRef.current = cmd;
      cmdSubscribedRef.current = false;
      cmd.subscribe((status) => {
        if (cancelled) return;
        if (cmdChRef.current !== cmd) return;
        if (status === 'SUBSCRIBED') { cmdSubscribedRef.current = true; return; }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          cmdSubscribedRef.current = false;
          cmdChRef.current = null;
          void client.removeChannel(cmd);
          if (roleRef.current !== 'controller') return;
          window.setTimeout(() => {
            if (!cancelled && roleRef.current === 'controller' && !cmdChRef.current) joinCmd();
          }, 1000);
        }
      });
    };

    joinCmdRef.current = joinCmd;
    leaveCmdRef.current = leaveCmd;

    const watch = (ch: RealtimeChannel, link: boolean, onSideDown?: () => void) => {
      const id = nextChannelId++;
      channelIds.set(ch, id);
      const generation = membership.generation;
      membership = openChannel(membership, id);
      ch.subscribe((status, err) => {
        if (cancelled) return;
        const effect = interpretChannelStatus(membership, { id, generation, carriesLink: link, status });
        if (effect.ignore) return;
        if (link) {
          const retry = linkRetryAction(status);
          if (retry === 'cancel') {
            window.clearTimeout(retryTimer);
            delay = LINK_RETRY_BASE_MS;
            setSubscribedAt(Date.now());
            setChannelFailed(false);
            setRealtimeDown(false);
            setChannelDetail(null);
          } else if (retry === 'arm' && effect.resubscribe) {
            setSubscribedAt(null);
            setChannelFailed(true);
            setRealtimeDown(true);
            setChannelDetail(formatChannelDetail(status, err));
            window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(() => { if (!cancelled) void resubscribe(); }, delay);
            delay = Math.min(15_000, delay * 2);
          }
        } else if (status === 'SUBSCRIBED') {
          delay = LINK_RETRY_BASE_MS;
        }
        if (effect.note !== undefined) setChannelNote(effect.note);
        if (effect.note) onSideDown?.();
      });
    };

    const openListen = (item: { topic: string; private: boolean; carriesLink: boolean }) => {
      const ch = item.private
        ? track(socket.channel(item.topic, { config: { private: true } }))
        : track(socket.channel(item.topic));
      if (item.carriesLink) {
        if (!item.private) publicChRef.current = ch;
        ch.on('broadcast', { event: 'telemetry' }, onTelemetry);
        ch.on('broadcast', { event: 'map' }, onMap);
        ch.on('broadcast', { event: 'log' }, onLog);
        ch.on('broadcast', { event: 'hb' }, onHb);
        if (item.private) {
          ch.on('broadcast', { event: 'cmd_ack' }, ({ payload }) => {
            const ack = parseCmdAck(payload);
            if (!ack) return;
            const wait = ackWaiters.current.get(ack.seq);
            if (!wait) return;
            ackWaiters.current.delete(ack.seq);
            wait(ack);
          });
        }
      } else if (item.topic === topics.ctl) {
        ch.on('broadcast', { event: 'control' }, () => {
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
      } else if (item.topic === topics.notify) {
        ch.on('broadcast', { event: 'control_lost' }, () => {
          const token = tokenRef.current;
          const epochNow = epochRef.current;
          const cmdCh = cmdChRef.current;
          if (roleRef.current === 'controller' && token && cmdCh && cmdSubscribedRef.current) {
            const seq = seqRef.current.next(epochNow);
            void cmdCh.send({
              type: 'broadcast',
              event: 'command',
              payload: privateCmdPayload({ type: 'nudge', lin: 0, ang: 0 }, { epoch: epochNow, token, seq, ts: alignedNow(Date.now(), offsetRef.current) }),
            });
          }
          tokenRef.current = null;
          roleRef.current = 'viewer';
          setRole('viewer');
          leaveCmd();
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
        ch.on('broadcast', { event: 'control_gained' }, () => {
          syncCmd('control_gained', 'controller');
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
        ch.on('broadcast', { event: 'control_result' }, ({ payload }) => {
          const status = payload && typeof payload === 'object' ? (payload as { status?: string }).status : undefined;
          if (status === 'accepted') syncCmd('accept', 'controller');
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
        ch.on('broadcast', { event: 'control_request' }, () => {
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
      }
      const generationAtOpen = membership.generation;
      watch(ch, item.carriesLink, () => {
        if (sideRetry.has(item.topic)) return;
        const timer = window.setTimeout(() => {
          sideRetry.delete(item.topic);
          if (cancelled || membership.generation !== generationAtOpen) return;
          const sideId = channelIds.get(ch);
          if (sideId == null || !membership.live.has(sideId)) return;
          membership = retireChannels(membership, [sideId], false);
          const idx = channels.indexOf(ch);
          if (idx >= 0) channels.splice(idx, 1);
          void client.removeChannel(ch);
          openListen(item);
        }, 1000);
        sideRetry.set(item.topic, timer);
      });
    };

    const subscribe = async () => {
      if (privateControl) {
        const { data } = await client.auth.getSession();
        const access = data.session?.access_token;
        if (access) await client.realtime.setAuth(access);
      }
      if (cancelled) return;
      const plan = controlListenPlan(botId, userId, privateControl ? '1' : '');
      for (const item of plan) openListen(item);
    };

    const resubscribe = async () => {
      clearSideRetries();
      const ids: number[] = [];
      for (const ch of channels) {
        const id = channelIds.get(ch);
        if (id != null) ids.push(id);
      }
      membership = retireChannels(membership, ids);
      for (const ch of channels) void socket.removeChannel(ch);
      channels.length = 0;
      publicChRef.current = null;
      leaveCmd();
      await subscribe();
      if (shouldHoldCmdChannel('resubscribe', roleRef.current)) joinCmd();
    };

    void subscribe();
    return () => {
      cancelled = true;
      window.clearTimeout(stamp);
      window.clearTimeout(retryTimer);
      clearSideRetries();
      unsubscribeAuth();
      const ids: number[] = [];
      for (const ch of channels) {
        const id = channelIds.get(ch);
        if (id != null) ids.push(id);
      }
      membership = retireChannels(membership, ids);
      leaveCmd();
      publicChRef.current = null;
      for (const ch of channels) void socket.removeChannel(ch);
    };
  }, [client, broadcastClient, userId, botId, privateControl, apply, syncCmd]);

  const refresh = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.rpc('bot_heartbeat', { p_bot: botId });
    if (error) { setHeartbeatError(error.message || 'Heartbeat failed'); return; }
    apply(data);
  }, [client, botId, apply]);

  const rpcCommand = useCallback(async (cmd: ControlCommand, epochNow: number, seq: number) => {
    if (!client) return { ok: false, error: 'no-client' };
    const { data, error } = await client.rpc('send_command', { p_bot: botId, p_epoch: epochNow, p_seq: seq, p_cmd: cmd });
    if (error) return { ok: false, error: error.message };
    const body = data as { ok?: boolean; error?: string } | null;
    if (body && body.ok === false) return { ok: false, error: body.error || 'rejected' };
    return { ok: true };
  }, [client, botId]);

  const sendCommand = useCallback(async (cmd: ControlCommand): Promise<CommandResult> => {
    const note = (result: CommandResult): CommandResult => {
      if (result.ok) setCommandError(null);
      else if (result.error !== 'viewer') setCommandError(shortCommandReason(result.error));
      return result;
    };
    if (roleRef.current !== 'controller') return note({ ok: false, error: 'viewer' });
    const epochNow = epochRef.current;
    const token = tokenRef.current;
    let seq = 0;
    try { seq = seqRef.current.next(epochNow); } catch { return note({ ok: false, error: 'epoch' }); }
    const ts = alignedNow(Date.now(), offsetRef.current);
    const armAck = () => {
      let timer = 0;
      let settled = false;
      let resolveAck: (ack: CmdAck | null) => void = () => {};
      const promise = new Promise<CmdAck | null>((resolve) => { resolveAck = resolve; });
      const finish = (ack: CmdAck | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        ackWaiters.current.delete(seq);
        resolveAck(ack);
      };
      timer = window.setTimeout(() => finish(null), ACK_TIMEOUT_MS);
      ackWaiters.current.set(seq, (ack) => finish(ack));
      return { promise, cancel: () => finish(null) };
    };
    if (privateControl) {
      const ch = cmdChRef.current;
      const subscribed = Boolean(cmdSubscribedRef.current && ch && token);
      const route = privateCommandRoute(cmd.type, subscribed);
      if (route === 'estop-rpc') {
        await rpcCommand({ type: 'estop' }, epochNow, seq);
        return note(estopRpcFallback());
      }
      if (route === 'blocked') return note({ ok: false, error: token ? 'no-channel' : 'no-token' });
      const armed = armAck();
      const res = await ch!.send({
        type: 'broadcast',
        event: 'command',
        payload: privateCmdPayload(cmd, { epoch: epochNow, token: token!, seq, ts }),
      });
      if (cmd.type === 'estop') void rpcCommand({ type: 'estop' }, epochNow, seq);
      if (res !== 'ok') {
        armed.cancel();
        const failed = estopRpcFallback();
        return note(cmd.type === 'estop' ? failed : { ok: false, error: 'send', via: 'timeout' });
      }
      const delivered = commandDelivery(await armed.promise, cmd.type === 'estop' ? 'estop' : 'other');
      if (!delivered.ok && delivered.via === 'ack' && (cmd.type === 'joy' || cmd.type === 'nudge') && delivered.error) {
        pushLog('error', delivered.error);
      }
      return note(delivered);
    }
    const ch = publicChRef.current;
    if (!ch) return note({ ok: false, error: 'no-channel' });
    const res = await ch.send({
      type: 'broadcast',
      event: 'command',
      payload: publicCommandEnvelope(botId, cmd, { id: crypto.randomUUID(), epoch: epochNow, seq, ts }),
    });
    return note({ ok: res === 'ok', via: 'broadcast', error: res === 'ok' ? undefined : 'send' });
  }, [privateControl, rpcCommand, botId, pushLog]);

  const requestControl = useCallback(async () => {
    if (!client) { setRequestError('network'); return; }
    setRequestError(null);
    const { data, error } = await client.rpc('request_control', { p_bot: botId });
    if (error) { setRequestError('network'); return; }
    apply(data);
  }, [client, botId, apply]);

  const cancelRequest = useCallback(async (id: string) => {
    if (!client) return;
    const { error } = await client.rpc('cancel_control_request', { p_id: id });
    if (error) setRequestError('network');
    await refresh();
  }, [client, refresh]);

  const respond = useCallback(async (id: string, accept: boolean) => {
    const name = pendingRequests.find((p) => p.id === id)?.name;
    if (!client) return { kind: 'retry' as const, name };
    const { data, error } = await client.rpc('respond_control_request', { p_id: id, p_accept: accept });
    if (error) return { kind: 'retry' as const, name };
    const body = (data ?? {}) as { ok?: boolean; reason?: string; status?: string };
    // Success is `{ok:true, status:'accepted'|'denied'}`. Keep's status is `denied` and must not look like a failure.
    if (body.ok !== true) {
      const kind = respondFailure(body.reason ?? body.status);
      if (kind === 'lost') {
        tokenRef.current = null;
        roleRef.current = 'viewer';
        setRole('viewer');
        syncCmd('control_lost', 'viewer');
      }
      await refresh();
      return { kind, name };
    }
    if (accept) {
      const token = tokenRef.current;
      const epochNow = epochRef.current;
      if (token) {
        const seq = seqRef.current.next(epochNow);
        const ts = alignedNow(Date.now(), offsetRef.current);
        const ch = privateControl ? cmdChRef.current : publicChRef.current;
        if (ch) {
          const payload = privateControl
            ? privateCmdPayload({ type: 'nudge', lin: 0, ang: 0 }, { epoch: epochNow, token, seq, ts })
            : publicCommandEnvelope(botId, { type: 'nudge', lin: 0, ang: 0 }, { id: crypto.randomUUID(), epoch: epochNow, seq, ts });
          void ch.send({ type: 'broadcast', event: 'command', payload });
        }
      }
      tokenRef.current = null;
      roleRef.current = 'viewer';
      setRole('viewer');
      syncCmd('control_lost', 'viewer');
    }
    await refresh();
    return { kind: 'ok' as const, name };
  }, [client, botId, privateControl, pendingRequests, refresh, syncCmd]);

  const heartbeatStale = heartbeatAt != null && now - heartbeatAt > 10_000;
  const link = !client || !userId
    ? connectingLink()
    : deriveLinkStatus({
      now,
      startedAt,
      subscribedAt,
      channelFailed,
      lastSeenSettled: lastSeen.settled,
      lastSeenReadable: lastSeen.readable,
      lastSeenAtMs: lastSeen.at,
      lastSeenChangedAt: lastSeen.changedAt,
      heartbeatReceivedAt,
      telemetryReceivedAt,
    });
  const signs = deriveStatusSigns({
    now,
    phase: link.phase,
    startedAt,
    subscribedAt,
    channelFailed,
    channelDetail,
    realtimeDown,
    unreadable: link.unreadable,
    sessionHeartbeatAt: heartbeatAt,
    sessionHeartbeatError: heartbeatError,
    bridgeHeartbeatAt: heartbeatReceivedAt,
    telemetryAt: telemetryReceivedAt,
    lastSeenChangedAt: lastSeen.changedAt,
    lastSeenReadable: lastSeen.readable,
    commandError,
    telemetryUnreadable,
  });

  return {
    privateControl,
    role,
    joining: joiningView,
    epoch,
    controllerId,
    controllerName,
    pendingRequests,
    myRequest,
    retryAfter,
    requestError,
    heartbeatError,
    heartbeatStale,
    realtimeDown,
    frame,
    map,
    logs,
    lastTelemetryAt,
    link,
    lagMs,
    slowLink,
    signs,
    channelNote,
    names,
    pushLog,
    sendCommand,
    requestControl,
    cancelRequest,
    respond,
    refresh,
  };
}

export type { HeartbeatView };
