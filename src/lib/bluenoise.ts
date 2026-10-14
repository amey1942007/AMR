/**
 * 64×64 blue-noise tile generated in code (Ulichney void-and-cluster, toroidal Gaussian σ 1.5). Own work, so no
 * third-party texture or credit is needed. Returns ranks scaled to 0–255 (R8). About 16M multiply-adds; run it once,
 * lazily, and cache it.
 */
export function blueNoise(N = 64, sigma = 1.5, seed = 7): Uint8Array {
  const n = N * N;
  const lut = new Float32Array(n);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = Math.min(x, N - x), dy = Math.min(y, N - y);
    lut[y * N + x] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
  }
  const E = new Float32Array(n), bin = new Uint8Array(n);
  const splat = (i: number, s: number) => {
    const ix = i % N, iy = (i / N) | 0;
    for (let y = 0; y < N; y++) { const ry = ((y - iy + N) % N) * N, row = y * N; for (let x = 0; x < N; x++) E[row + x] += s * lut[ry + ((x - ix + N) % N)]; }
  };
  const argBest = (want: number, max: boolean) => {
    let b = -1, bv = max ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) if (bin[i] === want && (max ? E[i] > bv : E[i] < bv)) { bv = E[i]; b = i; }
    return b;
  };
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const ones = Math.round(n * 0.1);
  for (let k = 0; k < ones; ) { const i = (rnd() * n) | 0; if (!bin[i]) { bin[i] = 1; splat(i, 1); k++; } }
  // Relax the initial pattern: move the tightest cluster to the largest void until stable.
  for (let it = 0; it < n; it++) {
    const c = argBest(1, true); bin[c] = 0; splat(c, -1);
    const v = argBest(0, false);
    if (v === c) { bin[c] = 1; splat(c, 1); break; }
    bin[v] = 1; splat(v, 1);
  }
  const rank = new Uint32Array(n), proto = bin.slice(), protoE = E.slice();
  // Phase 1: rank the initial points downward by removing the tightest clusters.
  for (let r = ones - 1; r >= 0; r--) { const c = argBest(1, true); bin[c] = 0; splat(c, -1); rank[c] = r; }
  bin.set(proto); E.set(protoE);
  // Phases 2 and 3: fill the largest voids upward.
  for (let r = ones; r < n; r++) { const v = argBest(0, false); bin[v] = 1; splat(v, 1); rank[v] = r; }
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.floor((rank[i] * 256) / n);
  return out;
}
