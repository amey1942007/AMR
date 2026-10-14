# Credits
Every third-party asset with its licence. Rendered on /credits/ (src/app/credits/page.tsx + src/data/credits.models.json).

| Asset | Author / source | Licence | Changes |
|---|---|---|---|
| Just1 mecanum robot (placeholder hero AMR) → `public/models/amr_hero_hi.glb`, `amr_hero_lo.glb` | Nicolas Rodriguez, https://github.com/NRdrgz/Just1 | MIT (`public/licenses/LICENSE-Just1.txt`) | STEP tessellated to GLB, parts renamed to site node names, scaled to 0.52 × 0.63 m, battery packs and L298N boards removed, re-materialised, accent strip added, simplified + Draco/Meshopt compressed |
| HDRI `studio_small_09` (1K .hdr; 2K re-encoded to log-WebP by `scripts/compress_hdri.py`) | Poly Haven, https://polyhaven.com/a/studio_small_09 | CC0 | 2K converted to 8-bit log-encoded WebP |
| Unbounded, Inter Tight, JetBrains Mono (variable, latin) | https://fontsource.org | SIL OFL 1.1 | — |
| UI icons (arrow-right, external-link, x, check, mail, github) | https://lucide.dev | ISC | inlined |
| Tech-stack logos (ros, raspberrypi, nvidia, python, cplusplus, threedotjs) | Simple Icons v16.35.0, https://simpleicons.org | CC0 (trademarks remain their owners') | monochrome |
| Cloud sprite `public/img/clouds/cloud.webp` (`scripts/make_cloud_sprite.py`) | own work | — | — |
