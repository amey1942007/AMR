/** Promise wrapper around the shared decode worker (lazily created, one per page). */
let w: Worker | null = null, seq = 0;
const pending = new Map<number, (d: { data?: ArrayBufferView; w?: number; h?: number; error?: string }) => void>();
function worker(): Worker | null {
  if (w) return w;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;
  w = new Worker(new URL('../workers/decode.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e) => { const f = pending.get(e.data.id); pending.delete(e.data.id); f?.(e.data); };
  return w;
}
export function decodeInWorker<T>(msg: { kind: 'hdri'; url: string } | { kind: 'bluenoise' }): Promise<T> | null {
  const wk = worker();
  if (!wk) return null;
  const id = ++seq;
  return new Promise<T>((res, rej) => { pending.set(id, (d) => (d.error ? rej(new Error(d.error)) : res(d as T))); wk.postMessage({ id, ...msg }); });
}
