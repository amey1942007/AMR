"""Offline asset tool: Radiance .hdr → log-encoded 8-bit RGB WebP (streamed "compressed 2K" env, ui-spec G13).
Encoding: c8 = round((log2(v) - LMIN) / (LMAX - LMIN) * 255), v<=2^LMIN → 0. Decoder: src/lib/hdri.ts.
Usage: python scripts/compress_hdri.py in.hdr out.webp [quality]"""
import sys, numpy as np
from PIL import Image
LMIN, LMAX = -8.0, 10.0

def read_hdr(path):
    d = open(path, 'rb').read()
    i = d.index(b'\n\n') + 2
    j = d.index(b'\n', i)
    parts = d[i:j].split()
    h, w = int(parts[1]), int(parts[3])
    p = j + 1
    out = np.zeros((h, w, 4), np.uint8)
    for y in range(h):
        if d[p] == 2 and d[p + 1] == 2:
            p += 4
            for c in range(4):
                x = 0
                while x < w:
                    n = d[p]; p += 1
                    if n > 128:
                        n -= 128; out[y, x:x + n, c] = d[p]; p += 1
                    else:
                        out[y, x:x + n, c] = np.frombuffer(d[p:p + n], np.uint8); p += n
                    x += n
        else:
            out[y] = np.frombuffer(d[p:p + w * 4], np.uint8).reshape(w, 4); p += w * 4
    e = out[..., 3].astype(np.float32)
    f = np.where(e > 0, np.ldexp(1.0, (e - 136).astype(np.int32)), 0).astype(np.float32)
    return out[..., :3].astype(np.float32) * f[..., None]

rgb = read_hdr(sys.argv[1])
lg = np.log2(np.maximum(rgb, 2 ** LMIN))
c = np.clip(np.round((lg - LMIN) / (LMAX - LMIN) * 255), 0, 255).astype(np.uint8)
Image.fromarray(c, 'RGB').save(sys.argv[2], 'WEBP', quality=int(sys.argv[3]) if len(sys.argv) > 3 else 92, method=6)
print(rgb.shape, float(rgb.max()))
