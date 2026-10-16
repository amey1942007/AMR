'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  HEARTBEAT_MS,
  PENDING_POLL_MS,
  alignedNow,
  createSeqCounter,
  privateCmdPayload,
  privateCommandRoute,
  publicCommandEnvelope,
  serverOffsetFromLease,
  shouldFastPoll,
} from './commands';
import { privateControlEnabled, privateListenTopics, publicChannel, shouldHoldCmdChannel, type CmdJoinEvent } from './channels';
import type { BotId, ConsoleLogLine, ControlCommand, MapFrame } from './protocol';
import { normalizeMap, normalizeTelemetry, type NormState } from './normalize';
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
  lastTelemetryAt: number | null;
  names: Record<string, string>;
  pushLog: (level: string, text: string) => void;
  sendCommand: (cmd: ControlCommand) => Promise<{ ok: boolean; error?: string }>;
  requestControl: () => Promise<void>;
  cancelRequest: (id: string) => Promise<void>;
  respond: (id: string, accept: boolean) => Promise<{ kind: 'ok' | 'ended' | 'left' | 'lost' | 'retry'; name?: string }>;
  refresh: () => Promise<void>;
}

export function useControlSession(
  client: SupabaseClient | null,
  userId: string | null,
  botId: BotId,
): ControlSession {
  const privateControl = privateControlEnabled();
  const [role, setRole] = useState<'controller' | 'viewer' | null>(null);
  const [joining, setJoining] = useState(true);
  const [joinedBot, setJoinedBot] = useState(botId);
  if (botId !== joinedBot) {
    setJoinedBot(botId);
    setJoining(true);
  }
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
    if (!client || !userId) return;
    let cancelled = false;
    let delay = 1000;
    let retryTimer = 0;
    const channels: RealtimeChannel[] = [];
    const track = (ch: RealtimeChannel) => { channels.push(ch); return ch; };

    const onTelemetry = ({ payload }: { payload: unknown }) => {
      const n = normalizeTelemetry(payload);
      if (!n) return;
      setFrame(n);
      setLastTelemetryAt(Date.now());
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
    const onHb = () => setLastTelemetryAt((t) => t ?? Date.now());

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
      const cmd = client.channel(topic, { config: { private: true } });
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

    const subscribe = async () => {
      const { data } = await client.auth.getSession();
      const access = data.session?.access_token;
      if (access) await client.realtime.setAuth(access);
      if (cancelled) return;

      const watch = (ch: RealtimeChannel) => {
        ch.subscribe((status) => {
          if (cancelled) return;
          if (status === 'SUBSCRIBED') { delay = 1000; setRealtimeDown(false); return; }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            setRealtimeDown(true);
            window.clearTimeout(retryTimer);
            retryTimer = window.setTimeout(() => { if (!cancelled) void resubscribe(); }, delay);
            delay = Math.min(15_000, delay * 2);
          }
        });
      };

      if (privateControl) {
        const topics = privateListenTopics(botId, userId);
        const status = track(client.channel(topics.status, { config: { private: true } }));
        status.on('broadcast', { event: 'telemetry' }, onTelemetry);
        status.on('broadcast', { event: 'map' }, onMap);
        status.on('broadcast', { event: 'log' }, onLog);
        status.on('broadcast', { event: 'hb' }, onHb);
        watch(status);
        const ctl = track(client.channel(topics.ctl, { config: { private: true } }));
        ctl.on('broadcast', { event: 'control' }, () => {
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
        watch(ctl);
        const notify = track(client.channel(topics.notify, { config: { private: true } }));
        notify.on('broadcast', { event: 'control_lost' }, () => {
          const token = tokenRef.current;
          const epochNow = epochRef.current;
          const ch = cmdChRef.current;
          if (roleRef.current === 'controller' && token && ch && cmdSubscribedRef.current) {
            const seq = seqRef.current.next(epochNow);
            void ch.send({
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
        notify.on('broadcast', { event: 'control_gained' }, () => {
          syncCmd('control_gained', 'controller');
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
        notify.on('broadcast', { event: 'control_result' }, ({ payload }) => {
          const status = payload && typeof payload === 'object' ? (payload as { status?: string }).status : undefined;
          if (status === 'accepted') syncCmd('accept', 'controller');
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
        notify.on('broadcast', { event: 'control_request' }, () => {
          void client.rpc('bot_heartbeat', { p_bot: botId }).then(({ data: beat, error }) => noteBeat(error, beat, 'heartbeat'));
        });
        watch(notify);
      } else {
        const ch = track(client.channel(publicChannel(botId)));
        publicChRef.current = ch;
        ch.on('broadcast', { event: 'telemetry' }, onTelemetry);
        ch.on('broadcast', { event: 'map' }, onMap);
        ch.on('broadcast', { event: 'log' }, onLog);
        ch.on('broadcast', { event: 'hb' }, onHb);
        watch(ch);
      }
    };

    const resubscribe = async () => {
      for (const ch of channels) void client.removeChannel(ch);
      channels.length = 0;
      publicChRef.current = null;
      leaveCmd();
      await subscribe();
      if (shouldHoldCmdChannel('resubscribe', roleRef.current)) joinCmd();
    };

    void subscribe();
    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
      leaveCmd();
      publicChRef.current = null;
      for (const ch of channels) void client.removeChannel(ch);
    };
  }, [client, userId, botId, privateControl, apply, syncCmd]);

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

  const sendCommand = useCallback(async (cmd: ControlCommand) => {
    if (roleRef.current !== 'controller') return { ok: false, error: 'viewer' };
    const epochNow = epochRef.current;
    const token = tokenRef.current;
    let seq = 0;
    try { seq = seqRef.current.next(epochNow); } catch { return { ok: false, error: 'epoch' }; }
    const ts = alignedNow(Date.now(), offsetRef.current);
    if (privateControl) {
      const ch = cmdChRef.current;
      const subscribed = Boolean(cmdSubscribedRef.current && ch && token);
      const route = privateCommandRoute(cmd.type, subscribed);
      if (route === 'cmd') {
        const res = await ch!.send({
          type: 'broadcast',
          event: 'command',
          payload: privateCmdPayload(cmd, { epoch: epochNow, token: token!, seq, ts }),
        });
        return { ok: res === 'ok', error: res === 'ok' ? undefined : 'send' };
      }
      if (route === 'estop-rpc') return rpcCommand({ type: 'estop' }, epochNow, seq);
      return { ok: false, error: token ? 'no-channel' : 'no-token' };
    }
    const ch = publicChRef.current;
    if (!ch) return { ok: false, error: 'no-channel' };
    const res = await ch.send({
      type: 'broadcast',
      event: 'command',
      payload: publicCommandEnvelope(botId, cmd, { id: crypto.randomUUID(), epoch: epochNow, seq, ts }),
    });
    return { ok: res === 'ok', error: res === 'ok' ? undefined : 'send' };
  }, [privateControl, rpcCommand, botId]);

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
