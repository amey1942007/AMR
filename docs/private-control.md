# Private control flow

Operator sign-in is email and password. Driving rights come from the control lease (`join_bot`, `bot_heartbeat`, `request_control`), not from `authority_rank` and not from Presence.

## Feature flag

`NEXT_PUBLIC_PRIVATE_CONTROL`

| Value | Realtime transport |
|---|---|
| unset, `0`, `false`, `off`, anything else | Public channel `amr-bot-<id>` (events `telemetry`, `map`, `log`, `hb`, `command`). This is the default so the live site keeps working with the current Pi bridge. |
| `1`, `true`, `on`, `yes` | Private topics `bot:<id>:status`, `bot:<id>:ctl`, `bot:<id>:cmd`, and `user:<uid>:notify`. |

Production Pages sets `NEXT_PUBLIC_PRIVATE_CONTROL=1` because the Pi bridge keeps `AMR_PUBLIC_CHANNEL=0` and only accepts drive/nav on private `:cmd`. Leave the flag unset only for local public-path checks. The lease RPCs run in both modes. The control token is sent only on the private `:cmd` topic. The public `command` broadcast never includes it.

The project Realtime setup has no message partitions, so a database push on `:ctl`, `:cmdq`, or `user:<uid>:notify` is dropped. The panel does not depend on those. Control state comes from `bot_heartbeat` (every 5 seconds, every 2 seconds while a request is pending). With the flag on, every command type — including discrete ones such as `nav_goal` and `run_tool` — is a client broadcast on `bot:<id>:cmd`, carrying the lease token and the shared time-based `seq`. The `:cmd` channel is created with `broadcast.ack` so the server confirms it accepted the frame. That server ack is not delivery. The bridge replies with a `cmd_ack` broadcast on `bot:<id>:status`, payload `{seq, ok, reason?}`. The panel marks a command delivered only when that ack is `ok` for the same seq. A rejection shows `reason` (bad token, stale epoch, lower seq, sanitize, and the rest). If no ack arrives within about 1.5 seconds, the command is not confirmed. E-STOP keeps retrying both `:cmd` and `send_command` until an ok ack. `send_command` never counts as delivery, because the bridge cannot see that row, so an RPC-only E-STOP stays on "E-STOP not confirmed, use the physical stop" and does not latch. With the flag off, commands stay on the public channel and latch from the broadcast result, because that bridge does not send `cmd_ack`.

Viewers do not subscribe to `bot:<id>:cmd`. The client joins `:cmd` only after a controller-shaped result: `join_bot` when the role is controller, `control_gained`, `control_result` with status `accepted`, or a heartbeat that still says controller. It leaves `:cmd` on `control_lost` and when Give sets the role to viewer. A listen-channel reconnect (`:status`, `:ctl`, `:notify`) does not open `:cmd`. It rejoins `:cmd` only if the role is still controller. A `:cmd` channel error retries that topic alone and does not resubscribe the listen channels.

`seq` is a millisecond timestamp, then +1 for later commands in the same epoch, so a reloaded page does not go backwards against rows already stored. Command `ts` adds the offset learned from the controller's own heartbeat: `lease_expires_at` is server now plus 15 seconds. The offset is updated only while the role is controller. A viewer heartbeat's lease belongs to the current driver and can be a few seconds stale.

A bridge `cmd_ack` rejection, an ack timeout, or an E-STOP that only reached `send_command` is toasted and written to the console. `rate limited` and `command too large` are shown when those phrases come back. A failed join or heartbeat shows the RPC message in the reconnect bar. Map names are blank (bridge timestamps the file) or `[A-Za-z0-9_-]{1,64}`. A space or other character shows an inline error and is not sent.

## Auth redirect allowlist

These exact URLs must be in the Supabase Auth redirect URL allowlist, or invite, recovery, and sign-in redirects will be rejected:

- `https://amrslam.tech/set-password`
- `https://amrslam.tech/sign-in`

## Known mismatches (do not guess past these)

- The Ros_lidar_bot `hardware` branch `amr-bridge/amr_telemetry_bridge/bridge.py` was not readable (GitHub 404). Keys were checked against the bridge in this repo.
- That bridge broadcasts camelCase (`mapPose`, `yoloDet`, `cameraJpegB64` as raw base64). The dashboard spec assumed snake_case SSE keys and an unnamed JPEG. The panel accepts both. Camera bytes are shown as `data:image/jpeg;base64,…`.
- Joy on both the public channel and the private `:cmd` payload is sent as `{a,b}` and as `{axes,buttons}`, because this bridge reads `axes` / `buttons` and the updated bridge accepts `a` / `b`. The private payload also carries `{epoch,token,seq,ts}`.
- This bridge drops every command except `set_rate` when `from.rank` is missing or below 1. The website no longer sends `from.rank`. Public-path drive commands will be ignored until the bridge is updated or the private flag is turned on against a bridge that does not check rank. Telemetry on the public channel still displays.
- `seq_*` waypoint commands are not in the `send_command` allowlist. The waypoint card is read-only. Those commands were not added.
- `drive` has no defined dashboard payload, so there is no drive-distance teleop control beyond the Tools card (`run_tool`). `set_rate` is accepted by this bridge but has no header control.
- Space is an E-STOP only when focus is not in an input, so typing a map name does not stop the robot. The name itself cannot contain spaces: it must be blank or match `[A-Za-z0-9_-]{1,64}`. Esc still stops, except while the keyboard-help dialog is open.
- While the heartbeat is stale the panel shows "Reconnecting…" and disables drive controls. E-STOP stays enabled for the controller, including when the bot looks offline.

## Manual test checklist

Run against a staging operator account. Do not use production cut-over. Leave `NEXT_PUBLIC_PRIVATE_CONTROL` unset for the public-path checks, then repeat the lease checks with the flag on in a non-production build.

Sign-in

- [ ] Signed-out `/control` redirects to `/sign-in/?next=/control/` (trailing slash as exported).
- [ ] Wrong email or password shows "Email or password is incorrect." The email field is not cleared.
- [ ] An Auth user who is not an active operator is signed out and sees "This account doesn't have access. Contact admin@amrslam.tech."
- [ ] Rate limit shows "Too many attempts. Try again in a minute."
- [ ] Offline shows "Can't reach the server. Check your connection."
- [ ] Forgot password always shows "If this email has access, a link is on its way." The link target is `https://amrslam.tech/set-password`.
- [ ] Invite and recovery open `/set-password` on Continue, then `verifyOtp`. A missing or used token shows the expired-link state and does not call verify on load.
- [ ] A password shorter than 10 characters cannot be submitted. A leaked password shows "Choose a stronger password. This one is too common."
- [ ] After a successful set, the page says "Password set. Taking you to the control panel…" and opens `/control`.

Lease

- [ ] Entering a bot calls `join_bot`, then `bot_heartbeat` about every 5 seconds. Leaving the page or switching bots calls `leave_bot`.
- [ ] Viewer badge is "View only". Controller badge is "You're in control". The header shows who is driving, or "No one is driving".
- [ ] Viewer controls are dimmed and not clickable. E-STOP is not shown. Toast once: "You joined as a viewer."
- [ ] Request control while someone drives: pending card, 10 second countdown, Cancel. The other operator sees a top-right prompt, not a modal. G gives, K keeps.
- [ ] Give: requester becomes controller, previous driver is view-only, toast "Control handed to &lt;Name&gt;."
- [ ] Keep or timeout: current driver stays, requester sees the denial or "Request timed out", then "Try again in Ns" for about 30 seconds.
- [ ] A second request stacks under the first. Only the first card counts down. Chip shows "+N waiting".
- [ ] Drop the token on `control_lost`. Do not log or render the token.

E-STOP and teleop (controller only)

- [ ] Header E-STOP and the pad centre send immediately. Space and Esc do the same outside text fields.
- [ ] Latch copy is "STOPPED · Re-arm". Hold about 1 second to clear. Banner "EMERGENCY STOP ACTIVE". Drive, nav, and tools stay disabled while latched. E-STOP stays available.
- [ ] E-STOP latches only after `cmd_ack` with `ok: true` for that seq. The button then shows "STOPPED · Re-arm" and the console line "E-STOP — motion halted, tool stopped, nav goal cancelled".
- [ ] If `:cmd` is down, or no ack arrives, the toast is "E-STOP not confirmed, use the physical stop". The button stays on retry and does not latch. Both `:cmd` and `send_command` keep being tried.
- [ ] A `cmd_ack` with `ok: false` shows `reason` (bad token, stale epoch, lower seq, sanitize) and E-STOP keeps retrying.
- [ ] W/S and arrows nudge lin ±0.15, A/D ang ±0.6, repeat while held, zero on release. Hard limits lin ±0.30 and ang ±1.0.
- [ ] Gamepad chip: "Gamepad connected", "No gamepad", or "Gamepad idle (view only)". Sticks go quiet on blur, disconnect, or losing control.

Dashboard

- [ ] Bot offline longer than 10 seconds: "&lt;Bot&gt; is offline · last seen HH:MM:SS". Controls disabled. Controller E-STOP still available.
- [ ] Stale telemetry longer than 2 seconds veils the canvas with "no data from robot…".
- [ ] Waypoint sequence renders goals read-only, with "Waypoint sequences aren't available remotely yet." No `seq_*` command is sent.
- [ ] Tools: one motion tool at a time, vision waits 4 seconds between toggles, invalid numbers get a red border. "Area is clear" is required before Calibrate and Drive.
- [ ] SLAM layer toggle stays off until a map frame arrives, and hides itself if inflate/decode fails.

Flag off vs on

- [ ] Flag unset: browser subscribes to `amr-bot-amr4` or `amr-bot-hardware-bot`. Command payloads have no `token` field.
- [ ] Flag on, viewer: browser subscribes to `:status`, `:ctl`, and `user:<uid>:notify` only. It does not open `:cmd`.
- [ ] Flag on, controller: `:cmd` is joined with `broadcast.ack`. Nav, tools, vision, save map, blacklist, nudge, and joy are broadcasts on `:cmd` with epoch, token, seq, and ts. Seq is one shared clock and increases inside one epoch. A command is delivered only after `cmd_ack`.
- [ ] Flag on, E-STOP while `:cmd` is `SUBSCRIBED`: the same broadcast, plus `send_command`, and latch only on `cmd_ack` ok. While it is not subscribed: `send_command` is still called, the result stays unconfirmed, and the panel keeps retrying.
- [ ] Save map rejects a name outside `[A-Za-z0-9_-]{1,64}` with the inline error. A blank name is allowed.
- [ ] `https://amrslam.tech/set-password` and `https://amrslam.tech/sign-in` are on the Supabase Auth redirect allowlist.
