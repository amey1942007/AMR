"""Own-work cloud sprite: 256² soft fBm blob. R = density (radial falloff × fBm), G = dissolve noise. → public/img/clouds/cloud.webp"""
import numpy as np
from PIL import Image
rng = np.random.default_rng(3)
N = 256
def fbm(oct=5):
    out = np.zeros((N, N))
    for o in range(oct):
        f = 2 ** (o + 2); g = rng.random((f + 1, f + 1))
        x = np.linspace(0, f, N, endpoint=False); i = x.astype(int); t = x - i; t = t * t * (3 - 2 * t)
        a = g[i][:, i] * (1 - t)[None, :] + g[i][:, i + 1] * t[None, :]
        b = g[i + 1][:, i] * (1 - t)[None, :] + g[i + 1][:, i + 1] * t[None, :]
        out += (a * (1 - t)[:, None] + b * t[:, None]) * 0.5 ** o
    return (out - out.min()) / (out.max() - out.min())
y, x = np.mgrid[-1:1:N * 1j, -1:1:N * 1j]
r = np.sqrt(x * x + y * y)
fall = np.clip(1 - r, 0, 1) ** 1.6
d = np.clip(fall * (0.35 + 0.9 * fbm()), 0, 1)
g = fbm(4)
img = np.dstack([d, g, np.zeros_like(d)])
Image.fromarray((img * 255).astype(np.uint8), 'RGB').save('public/img/clouds/cloud.webp', 'WEBP', quality=85)
