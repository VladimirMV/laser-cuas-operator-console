# Laser C-UAS Operator Console

**Private** HMI demo — Common Laser Technologies / ISP NASU.

https://github.com/VladimirMV/laser-cuas-operator-console

## Local run

**Windows (recommended): Docker Desktop**, then `start-docker.cmd` (or `docker compose up --build`).

- HMI http://127.0.0.1:5173 · sidecar http://127.0.0.1:8787/status
- Recordings: `sidecar\media` on the host disk
- Live cameras: copy `.env.docker.example` → `.env` and set `STREAM_*`

This avoids WDAC (blocked `*.node`) and does not need a host FFmpeg.

Without Docker:

```bash
npm install
npm run dev
```

Open the URL Vite prints (default port 5173).

### Windows (WDAC / Smart App Control)

If `npm run dev` fails with `Cannot find module @rollup/rollup-win32-x64-msvc` or **Application Control policy has blocked this file**, the zip was marked as internet-downloaded and Windows blocked native addons.

In PowerShell **from the project folder** (the one that contains `package.json`):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-win.ps1
```

Or by hand:

```powershell
Get-ChildItem -Recurse | Unblock-File
Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```

This tree uses **WASM Rollup / esbuild** (`overrides` in `package.json`) so WDAC does not need to allow `*.node` / `esbuild.exe`. Prefer **Node 22 LTS** over Node 24 if anything else breaks.

Do not run `npm i` in the parent unzip folder — `package.json` must be in the current directory.

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
