# amr-bridge

Cloud telemetry bridge for [Ros_lidar_bot](https://github.com/amey1942007/Ros_lidar_bot) → Supabase Realtime → [amrslam.tech/control](https://amrslam.tech/control/).

## Why `/control` (not a bot subdomain)

Same-origin auth with the marketing site, existing AuthGuard + Supabase session, one CSP surface. Camera can still be a separate Cloudflare Tunnel URL when the browser cannot reach the Pi over Tailscale.

## Network

| Hop | Role |
| --- | --- |
| IITD Wi‑Fi + Tailscale | Ops SSH / local dashboard `http://<tailscale-ip>:8080` |
| Supabase Realtime (TLS) | Browser ↔ Pi telemetry + commands |
| Cloudflare Tunnel (optional) | Public MJPEG `camera_url` when needed |

## Pi setup

```bash
# On the robot, with robot_dashboard_node already on :8080
cd amr-bridge
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export AMR_BOT_ID=amr4          # or hardware-bot
export AMR_SUPABASE_URL=https://khucmrlbstdlbxcuboub.supabase.co
export AMR_SUPABASE_SERVICE_KEY=…   # service role — never commit / never put in the site
export AMR_DASHBOARD_URL=http://127.0.0.1:8080
# optional:
# export AMR_CAMERA_URL=https://cam-amr4.your-tunnel.example/camera.mjpg

python -m amr_telemetry_bridge
```

Run two processes (or two systemd units) for **both bots**, each with its own `AMR_BOT_ID`.

## Authority

Ranks live in `operator_profiles.authority_rank` (migration in `supabase/migrations/`):

| Rank | Label | Drive | Preempt |
| --- | --- | --- | --- |
| 0 | Viewer | no | — |
| 1 | Operator | yes | equal+ |
| 2 | Admin | yes | yes |
| 3 | Owner | yes | yes |

Control lock uses Realtime presence. Higher (or equal) rank takes the lock; others remain view-only. E-STOP is allowed for any operator+ without holding the lock.

## Adaptive rate

Browsers request `full` (10 Hz + lidar/camera/3D) or `board` (1 Hz vitals) via `set_rate`. When mean lag exceeds ~800 ms the control panel falls back to the status board automatically.

## Protocol

Shared shapes: `src/lib/telemetry/protocol.ts` ↔ `amr_telemetry_bridge/protocol.py`.

Channels: `amr-bot-amr4`, `amr-bot-hardware-bot`  
Events: `telemetry`, `map`, `hb`, `command`
