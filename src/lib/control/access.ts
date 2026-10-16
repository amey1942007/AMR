/** Access-flow timings, copy, and parsers. No secrets. */

export const SET_PASSWORD_REDIRECT = 'https://amrslam.tech/set-password';
export const MIN_PASSWORD = 10;

export const COPY = {
  invalid: 'Email or password is incorrect.',
  forbidden: "This account doesn't have access. Contact admin@amrslam.tech.",
  rate: 'Too many attempts. Try again in a minute.',
  network: "Can't reach the server. Check your connection.",
  resetSent: 'If this email has access, a link is on its way.',
  expiredLink: 'This link has expired or was already used.',
  weak: 'Choose a stronger password. This one is too common.',
  mismatch: "Passwords don't match.",
  requestFail: "Couldn't request control. Check your connection.",
  respondFail: "Couldn't send. Retrying",
  requestEnded: 'That request has already ended.',
  kept: 'You kept control.',
  noResponse: 'No response: you kept control.',
  handed: (name: string) => `Control handed to ${name}.`,
  nowDriving: (name: string) => `${name} is now driving.`,
  joinedViewer: 'You joined as a viewer.',
  estopFail: 'E-STOP not confirmed, retrying',
  estopLog: 'E-STOP — motion halted, tool stopped, nav goal cancelled',
} as const;

export function secondsRemaining(expiresAt: string | null | undefined, now = Date.now()): number {
  if (!expiresAt) return 0;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.ceil((t - now) / 1000));
}

/** `0:10` style used on the pending card. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function countdownFraction(expiresAt: string | null | undefined, now = Date.now(), windowS = 10): number {
  if (!expiresAt || windowS <= 0) return 0;
  const t = Date.parse(expiresAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(1, (t - now) / 1000 / windowS));
}

export function passwordRules(password: string, confirm: string) {
  return {
    length: password.length >= MIN_PASSWORD && password.length <= 128,
    match: password.length > 0 && password === confirm,
  };
}

/** Four segments, empty until the operator types. Not a leak check — the server does that. */
export function strengthSegments(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let n = 0;
  if (password.length >= MIN_PASSWORD) n += 1;
  if (password.length >= 14) n += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) n += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) n += 1;
  return Math.min(4, n) as 0 | 1 | 2 | 3 | 4;
}

export function isWeakPasswordMessage(message: string | undefined): boolean {
  if (!message) return false;
  return /weak|leaked|pwned|common|breach|hibp/i.test(message);
}

export function isExpiredLinkMessage(message: string | undefined): boolean {
  if (!message) return false;
  return /expired|already|invalid|otp/i.test(message);
}

export interface PendingRequest {
  id: string;
  requester: string;
  name: string;
  expiresAt: string;
}

export interface MyRequest {
  id: string;
  status: string;
  expiresAt: string | null;
  resolvedAt: string | null;
}

export interface HeartbeatView {
  role: 'controller' | 'viewer';
  botId: string;
  epoch: number;
  controller: string | null;
  controllerName: string | null;
  leaseExpiresAt: string | null;
  token: string | null;
  pendingRequests: PendingRequest[];
  myRequest: MyRequest | null;
  retryAfter: number | null;
}

export function parseHeartbeat(raw: unknown): HeartbeatView | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const role = o.role === 'controller' || o.role === 'viewer' ? o.role : null;
  if (!role) return null;
  const pending = Array.isArray(o.pending_requests) ? o.pending_requests : [];
  const mine = o.my_request;
  return {
    role,
    botId: typeof o.bot_id === 'string' ? o.bot_id : '',
    epoch: Number(o.epoch ?? 0),
    controller: typeof o.controller === 'string' ? o.controller : null,
    controllerName: typeof o.controller_name === 'string' ? o.controller_name : null,
    leaseExpiresAt: typeof o.lease_expires_at === 'string' ? o.lease_expires_at : null,
    token: role === 'controller' && typeof o.token === 'string' ? o.token : null,
    pendingRequests: pending.map(parsePending).filter((p): p is PendingRequest => p != null),
    myRequest: parseMine(mine),
    retryAfter: typeof o.retry_after === 'number' && Number.isFinite(o.retry_after) ? o.retry_after : null,
  };
}

function parsePending(raw: unknown): PendingRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string') return null;
  return {
    id: o.id,
    requester: typeof o.requester === 'string' ? o.requester : '',
    name: typeof o.name === 'string' && o.name ? o.name : 'Someone',
    expiresAt: typeof o.expires_at === 'string' ? o.expires_at : '',
  };
}

function parseMine(raw: unknown): MyRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.status !== 'string') return null;
  return {
    id: o.id,
    status: o.status,
    expiresAt: typeof o.expires_at === 'string' ? o.expires_at : null,
    resolvedAt: typeof o.resolved_at === 'string' ? o.resolved_at : null,
  };
}

export function respondFailure(reason: string | null | undefined): 'ended' | 'left' | 'lost' | 'retry' {
  if (reason === 'expired' || reason === 'not_found' || reason === 'denied') return 'ended';
  if (reason === 'requester_inactive') return 'left';
  if (reason === 'not_controller') return 'lost';
  return 'retry';
}

export function initialOf(name: string | null | undefined): string {
  const t = (name ?? '').trim();
  return t ? t.slice(0, 1).toUpperCase() : '?';
}
