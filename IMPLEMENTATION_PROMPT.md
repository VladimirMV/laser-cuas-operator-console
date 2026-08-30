# PROMPT — Laser C-UAS HMI v1.8.0 (Archive Replay + HUD)

You are implementing **HMI 1.8.0** on top of **Laser C-UAS Operator Console v1.7.5 GpsReadyCal**.
Do **not** rewrite the laser safety chain, Panoptes adapters, calibration, BITE, gamepad, or i18n EN/UA.
Fork the existing Vite + React 19 + Zustand + Tailwind v4 app. Version bump to `1.8.0`.

This is a **defensive C-UAS operator console** (laser effector vs Shahed/FPV). UI language: EN + UA.
Combat chrome stays GitHub-Primer dark (`#0D1117 / #161B22 / #3FB950 / #D29922 / #F85149 / #58A6FF`).
Monospace for IDs, ranges, times (`tabular-nums`). No emoji. No purple.

---

## 0. Invariants (do not break)

1. Laser chain: SAFE → ARM (two-step confirm) → hold-to-FIRE. Esc = SAFE + close overlay.
2. Replay **never** sends PTZ, laser, or effector commands. Banner `REPLAY · NO EFFECTORS` always visible in archive player.
3. FIRE / ARM events are immutable. Delete session only if `!sealed && laser === SAFE`.
4. Four archive streams stay separate: `events` | `telemetry` | `media` | `config`. Do not merge into one JSON blob as the source of truth.
5. Hierarchy: `mission → session → engagement → track → event`. Clock: `t_mono_ms` from `SESSION_START` + `ts_utc`.
6. Real video encode stays in the **workstation sidecar** (FFmpeg H.265, fallback H.264). Browser writes the **index**. No HEVC MediaRecorder in Chrome.
7. Video is never written to turret disk.

---

## 1. Combat HUD (replace the 8-panel stack)

Add `combatChrome: 'hud' | 'stack'` to the Zustand store (persist in `localStorage`, default **`hud`**). Toggle in the status bar.

**stack** = current 1.7.5 right column (PIP, ModeLaser, Compass, AI, Effectors, SitMap, Cues, Target). Keep for vehicle/debug.

**hud** (default):
- Main video fills the remaining viewport.
- Compass + elevation stay as overlays on the video (or compact in WEAPON tab — do not duplicate if overlay exists).
- Right dock **≤ 19rem**, **four tabs**, no inner scroll of eight panels:

| Tab | Content |
|-----|---------|
| CAM | `PipWindows` + channel buttons |
| WEAPON | `ModeLaserPanel` + `TurretCompass` |
| C2 | `ExternalCues` + `SituationMap` + `AiDetectPanel` |
| SYS | `TargetPanel` + `EffectorLadder` |

Splitter still collapses the dock (hotkey unchanged).

**Track box:** stop hardcoding `left:42%; top:36%; width:16%; height:24%`. Use `target.posX` / `target.posY` (percent of video). Size scales weakly with range (`clamp(8, 28, 18000/range)` percent). Coast = dashed amber; TRACKING quality>70 green else amber/red.

**Status bar:**
- Keep SYS / LASER / ILK / CAL / REC / TURRET / GPS / MODE.
- Add **RING 90s** chip when sidecar/mock ring is hot (always true in demo after mount).
- When not recording, show target codec + preset on hover of REC.
- Rec channel chips LONG/WIDE/IR on the status bar (not only inside Archives). Disabled while REC runs.

**Archives is a workspace, not a modal.** `screen === 'SESSIONS'` replaces the main video+dock area. **StatusBar + SafetyStrip stay mounted** so live laser state remains visible. Title strip: `ARCHIVE WORKSPACE · laser live = {SAFE|ARMED|FIRING}`. Close (Esc / V toggle / ✕) returns to COMBAT.

---

## 2. Archive player (the missing feature)

Replace `SessionArchive` list-of-labels with a three-pane workspace:

```
[ session list 280px ] [ player + transport + timeline ] [ events + engagement card ]
```

### 2.1 Session list
- Live row first (current `eventLog`).
- Then `archiveMock.listSessions()`: id, duration, FIRE badge, channels, size estimate, sealed lock, operator note.
- Filter FIRE. Delete only unsealed + SAFE.
- JSON / CSV export on selection (already exists).

### 2.2 Player
- Reconstruct a **visual feed** from archive state at `playheadMs` (canvas is OK for demo; if sidecar `url` exists, use `<video>` + seek).
- Channels: LONG / IR / WIDE as recorded. Layouts: **split** (default LONG|IR), **pip**, **single**.
- Overlay HUD restored from nearest telemetry ± events:
  `laser, track, range, az, el, quality, classification, recording`.
- Banner `REPLAY · NO EFFECTORS`. REC chip if playhead is inside REC_START…REC_STOP (including preroll).
- Transport: −5s / play-pause / +5s / rate `0.25 0.5 1 2 4` / jump **CUE TRACK ARM FIRE LOST**.
- Play uses `requestAnimationFrame`, respects `prefers-reduced-motion` (instant seek only).

### 2.3 Timeline
- Width = session `duration_sec`.
- Preroll region (REC_START − 15s → REC_START) in accent wash.
- Engagement spans in amber.
- Markers: C cue, T acquire, A arm, F fire_start, L lost. Two rows so they do not overlap.
- Playhead = 2px + diamond. Click/drag seeks **all** channels + event list + HUD to the same `t_mono_ms`.

### 2.4 Event column
- Click event → seek to its `t_mono_ms`.
- Auto-scroll active event into view.
- Engagement card: id, result, shots, range min/max, button “jump to start”.
- Button **Export ENG T−15…T+25** (demo: download a JSON sidecar of {session, engagement, event_ids, media_clip_label}; production sidecar would cut mp4).

### 2.5 Seed
`MockArchiveAdapter.seedDemo()` must create a **Shahed-136** sealed session ~124 s with explicit `t_mono_ms` (do **not** stamp all events at `Date.now()` — that collapses the timeline). Include:
- CUE → SLEW → TRACK_ACQUIRE → REC_START (with −15s preroll media refs) → ARM → FIRE×3 → COAST → REACQUIRE → ARM → FIRE → LOST → SAFE → SESSION_STOP.
- Engagement result `KILL_SOFT`, `had_fire: true`.
- MediaRefs: SEGMENT preroll + segments + SNAPSHOT on FIRE_START + CLIP `media/clips/ENG-…_T-15_T+25_long.mp4`.
- Extend `appendEvent` / `attachMediaRef` / `appendTelemetry` to accept optional `t_mono_ms` for seeding.

---

## 3. Recording pipeline (demo + sidecar)

### 3.1 Ring + preroll
- Store `ringHot: true` (demo). Production sidecar keeps 90 s fMP4 per channel.
- On `REC_START`, attach preroll MediaRefs: `t_mono_ms = now - 15000` (clamped ≥ 0), `kind: 'SEGMENT'`, label `PREROLL {ch} −15s from ring`.
- `recordingProfile.prerollSec = 15`.

### 3.2 ON_ENGAGEMENT
If preset is `ON_ENGAGEMENT` and not recording:
- `TRACK_ACQUIRE` / `TRACK_REACQUIRE` / `CUE_SLEW` → auto `toggleRecording()`.
- `TRACK_LOST` or `LASER_SAFE` → stop REC after 2.5 s (post-roll). Do not auto-stop if the operator started REC manually (preset COMBAT/ALL/CUSTOM).

### 3.3 Sidecar filenames
Today: `seg_%04d_h265.mp4`. Spec: `seg_{nnnn}_t{mono}_h265.mp4`.
On `/record/stop`, rename listed segments:
`seg_{idx:04d}_t{idx * segmentDurationSec * 1000 padded}_h265.mp4`
and write those names into `media_index.jsonl`.
Document `ring/` directory in sidecar README (always-on 90 s, NVMe, not NAS).

### 3.4 Telemetry rate
Keep 1 Hz idle. While `laserStatus === 'FIRING'` or an engagement is open, sample **10 Hz** (`archiveTickTelemetry` interval 100 ms when firing, else 1000 ms). Cap 3600 samples idle / 18000 during fire in the mock.

---

## 4. Copy / i18n

Add EN+UA keys (no new language):  
`combatHud`, `combatStack`, `dockCam`, `dockWeapon`, `dockC2`, `dockSys`, `ringHot`, `replayBanner`, `preroll`, `exportClip`, `jumpCue`, `jumpTrack`, `jumpArm`, `jumpFire`, `jumpLost`, `archLiveLaser`, `recRingHint`.

Safety strip version string: `HMI 1.8.0`. README + ARCHIVING.md updated to match this spec. `SW_VERSION = '1.8.0'`.

---

## 5. Out of scope

- Do not implement real FFmpeg in the browser.
- Do not add auth, cloud, or a second CSS design system.
- Do not auto-classify KILL from shots (keep result enum; seed may say KILL_SOFT explicitly).
- Do not command the laser from replay even as a “debug” hook.

---

## 6. Done when

- Combat HUD is the default; stack is one click away; no eight-panel scroll in HUD.
- Archives is a workspace with play/seek/split IR, timeline markers, restored HUD, preroll band.
- Seeded Shahed session is playable immediately (FIRE jumps to a firing frame).
- REC preroll refs appear; ON_ENGAGEMENT auto-starts on acquire.
- Sidecar stop-rename writes `t{mono}` into segment filenames.
- `npm run build` succeeds. Keyboard V opens archive, Esc returns to combat + SAFE if needed.
