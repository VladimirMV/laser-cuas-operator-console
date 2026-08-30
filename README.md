# Laser C-UAS Operator Console

**Private** HMI demo — Common Laser Technologies / ISP NASU.

https://github.com/VladimirMV/laser-cuas-operator-console

## Local run
```bash
npm install
npm run dev
```
http://localhost:5173

## Web demo (GitHub Pages)
After Actions succeeds:
**https://vladimirmv.github.io/laser-cuas-operator-console/**

Settings → Pages → Source: **GitHub Actions**.

Private repo: Pages is visible to collaborators. For external reviewers use Cloudflare Pages or add them as collaborators.

## Version
**v1.8.0** — Combat HUD (CAM / WEAPON / C2 / SYS dock) + Archive workspace with real replay.

- Default chrome is **HUD** (toggle **STACK** in the status bar for the 1.7.5 eight-panel column).
- **Archives** is a workspace, not a modal. Status bar + safety strip stay live. Replay never commands laser / PTZ (`REPLAY · NO EFFECTORS`).
- Seeded Shahed-136 session (~124 s) plays immediately; FIRE jump seeks to the first pulse.
- Recording: 90 s ring + 15 s preroll, `ON_ENGAGEMENT` auto-REC on acquire, sidecar segments rename to `seg_{nnnn}_t{mono}_h265.mp4`.
- Telemetry 1 Hz idle, 10 Hz while FIRING / open engagement.

See [ARCHIVING.md](ARCHIVING.md) and [IMPLEMENTATION_PROMPT.md](IMPLEMENTATION_PROMPT.md).

Keyboard: **V** archive workspace · **Esc** back to combat (and SAFE if needed).

## Panoptes test turret (v1.6.0)

Connect HMI to Wi-Fi turret (`panoptes.local` / `panoptes-base.local`):

```bash
cp .env.example .env
# edit hosts if needed
npm run dev
```

| Channel | Source |
|---------|--------|
| LONG | `http://panoptes-base.local/2k-stream` (MJPEG day 2K) |
| IR | `http://panoptes.local/thermal/stream` |
| WIDE | Not fitted (placeholder) |

PTZ: `ws://panoptes.local/ws/joystick` · Telemetry: `/ws/telemetry`  
GOTO/HOME/E-STOP on Turret panel. Laser chain remains mock.

Set `VITE_USE_REAL_TURRET=false` to return to demo HLS + local slew.
