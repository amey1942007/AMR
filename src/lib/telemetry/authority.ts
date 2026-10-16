import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  canTakeControl,
  clampAuthority,
  type AuthorityRank,
  type BotId,
  type ControlLockPresence,
  channelName,
} from './protocol';

export interface OperatorProfile {
  userId: string;
  email?: string;
  rank: AuthorityRank;
}

export async function fetchOperatorProfile(
  client: SupabaseClient,
  userId: string,
): Promise<OperatorProfile> {
  const { data } = await client
    .from('operator_profiles')
    .select('user_id, email, authority_rank')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return { userId, rank: 0 };
  return {
    userId: data.user_id as string,
    email: (data.email as string | null) ?? undefined,
    rank: clampAuthority(data.authority_rank),
  };
}

type PresenceState = Record<string, ControlLockPresence[]>;

function pickController(state: PresenceState): ControlLockPresence | null {
  let best: ControlLockPresence | null = null;
  for (const rows of Object.values(state)) {
    for (const p of rows) {
      if (!p?.controlling) continue;
      if (!best || p.rank > best.rank || (p.rank === best.rank && p.since < best.since)) {
        best = p;
      }
    }
  }
  return best;
}

export interface ControlLockApi {
  channel: RealtimeChannel;
  /** Current controller (may be self). */
  getController: () => ControlLockPresence | null;
  /** Try to become controller. Returns whether this client holds the lock. */
  requestControl: () => Promise<boolean>;
  releaseControl: () => Promise<void>;
  subscribe: (cb: (c: ControlLockPresence | null) => void) => () => void;
  destroy: () => Promise<void>;
}

export function attachControlLock(
  client: SupabaseClient,
  botId: BotId,
  self: OperatorProfile,
  opts?: { privateChannel?: boolean },
): ControlLockApi {
  // Public amr-bot-* channel unless NEXT_PUBLIC_PRIVATE_CONTROL is exactly "1".
  const channel = client.channel(channelName(botId), {
    config: {
      private: opts?.privateChannel === true,
      presence: { key: self.userId },
    },
  });

  let controller: ControlLockPresence | null = null;
  const listeners = new Set<(c: ControlLockPresence | null) => void>();
  const emit = () => { for (const cb of listeners) cb(controller); };

  const sync = () => {
    const state = channel.presenceState() as PresenceState;
    controller = pickController(state);
    emit();
  };

  channel.on('presence', { event: 'sync' }, sync);
  // Do not subscribe here. supabase-js ignores a second subscribe() once the
  // socket is opening, so the telemetry hook must be the single subscriber
  // (broadcast listeners + SUBSCRIBED callback share that join).

  const track = async (controlling: boolean) => {
    const payload: ControlLockPresence = {
      userId: self.userId,
      email: self.email,
      rank: self.rank,
      controlling,
      since: Date.now(),
    };
    await channel.track(payload);
  };

  return {
    channel,
    getController: () => controller,
    async requestControl() {
      if (!canTakeControl(self.rank, controller?.rank)) return false;
      if (controller && controller.userId !== self.userId && self.rank < controller.rank) {
        return false;
      }
      // Equal or higher rank: claim (preempt).
      await track(true);
      sync();
      return controller?.userId === self.userId || canTakeControl(self.rank, controller?.rank);
    },
    async releaseControl() {
      await track(false);
      sync();
    },
    subscribe(cb) {
      listeners.add(cb);
      cb(controller);
      return () => { listeners.delete(cb); };
    },
    async destroy() {
      listeners.clear();
      await client.removeChannel(channel);
    },
  };
}
