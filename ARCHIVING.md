# Mission Archive (HMI 1.8.0)

## Hierarchy

```
mission_id → session_id → engagement_id → track_id → event_id
```

## Four streams (do not merge)

| Stream | Format | Content |
|--------|--------|---------|
| Events | JSONL / in-memory | Tactical + operator actions (append-only) |
| Telemetry | JSONL samples @ 1 Hz idle / 10 Hz while FIRING | Laser, turret, GPS, track snapshot |
| Media | Index + sidecar files | Ring preroll, segments, FIRE snapshots, ENG clips |
| Config | Snapshot JSON | Parallax, cal status, layout, SW version |

## Time

- `ts_utc` — ISO-8601 UTC
- `t_mono_ms` — milliseconds from `SESSION_START` (master clock)

## Event types

SESSION_START/STOP, MODE_CHANGE, TRACK_*, CUE_*, LASER_SAFE/ARM/FIRE_*,
EFFECTOR_CMD, CAL_*, BITE_*, REC_*, INTERLOCK_CHANGE, LINK_CHANGE,
OPERATOR_NOTE, SYSTEM_WARN/FAULT

## Engagement

Opened on TRACK_ACQUIRE / TRACK_REACQUIRE / CUE_SLEW.  
Closed on TRACK_LOST or LASER_SAFE.  
Aggregates: duration, range min/max, max quality, shots_fired, result  
(`KILL_SOFT` | `NO_EFFECT` | `ABORT` | `UNKNOWN` — seed may set explicitly; do not auto-classify from shots in production).

## Replay (1.8.0)

Archives is a **workspace** (not a modal). Status bar + safety strip stay mounted so live laser state is visible.

Player reconstructs HUD from events + nearest telemetry at `playheadMs`:
`laser, track, range, az, el, quality, classification, recording`.

- Banner always: `REPLAY · NO EFFECTORS`
- Layouts: split LONG|IR (default), PIP, single
- Timeline: preroll wash (REC_START − 15 s), engagement span, markers C/T/A/F/L
- Export: JSON / CSV / clip descriptor `ENG T−15…T+25` (sidecar would cut H.265)

Replay **never** sends PTZ, laser, or effector commands.

## Seed

`MockArchiveAdapter.seedDemo()` creates a sealed **Shahed-136** session ~124 s with explicit `t_mono_ms` (not `Date.now()` on every event). Includes CUE → SLEW → ACQUIRE → REC (preroll −15 s) → ARM → FIRE×3 → COAST → REACQUIRE → ARM → FIRE → LOST → SAFE. Result `KILL_SOFT`.

## Export

- **JSON** — full `SessionBundle` (session, events, telemetry, media, config, engagements)
- **CSV** — engagement summary + event table
- **Clip sidecar** — `{session, engagement, event_ids, media_clip_label}` (demo JSON; production sidecar cuts mp4)

## Adapters

```ts
IArchiveWriter  // startSession, appendEvent, appendTelemetry, attachMediaRef, sealSession
IArchiveReader  // listSessions, getSession, queryEvents, export*
```

Demo: `MockArchiveAdapter` (memory).  
Production: side-car on operator workstation / NAS (not turret disk).

## Safety

- FIRE/ARM events are immutable (no edit UI)
- Delete session only if not sealed **and** laser SAFE
- Replay is visual only — does not command the laser
- Laser chain: SAFE → ARM (two-step) → hold-to-FIRE. Esc = SAFE + close overlay.

## Integration

- `logEvent()` dual-writes to live `eventLog` + `archiveMock`
- App mounts → `ensureArchiveSession()` + 1 Hz `archiveTickTelemetry()` (100 ms while FIRING)
- `ON_ENGAGEMENT` preset auto-starts REC on TRACK_ACQUIRE / SLEW; auto-stops 2.5 s after TRACK_LOST / SAFE
- UI: Archive workspace (V). Combat HUD is default chrome.

## Media / H.265

Production target codec: **H.265 (HEVC)**. Browser HMI demo writes **meta index only** (`codec: meta`), with `target` codec stored in REC_START payload. No HEVC MediaRecorder in Chrome.

### Layout
```
sidecar/media/                                    # mediaRoot (NVMe workstation)
  ring/{long|wide|ir}/r_00.mp4 … r_14.mp4         # 90 s wrap, always-on
  {sessionId}/media/{long|wide|ir}/
    preroll/preroll_{nn}_t{mono}.mp4              # −15 s copy from ring
    seg_{nnnn}_t{mono}_h265.mp4                   # session take
  {sessionId}/media/snapshots/{t_mono}_{EVENT}_{ch}.jpg
  {sessionId}/media/clips/ENG-…_T-15_T+25_{ch}.mp4
  {sessionId}/media_index.jsonl
```
Start: `npm run sidecar` or `start-sidecar.ps1`. HMI REC talks to http://127.0.0.1:8787.

On `/record/stop` the sidecar **renames** FFmpeg `seg_%04d_h265.mp4` to `seg_{nnnn}_t{idx * segmentDurationSec * 1000}_h265.mp4` and writes those names into `media_index.jsonl`.

### Presets
| Preset | Channels |
|--------|----------|
| ALL | LONG+WIDE+IR |
| COMBAT (default) | LONG+IR |
| ACQ | WIDE |
| CUSTOM | operator chips |
| ON_ENGAGEMENT | same channels, auto REC during open engagement + 15 s preroll from ring |

### Ring + preroll
Sidecar keeps a 90 s rolling fMP4 per channel on workstation NVMe. On `REC_START` the HMI attaches preroll MediaRefs (`t_mono_ms = now − 15000`, `kind: SEGMENT`, label `PREROLL {ch} −15s from ring`). `recordingProfile.prerollSec = 15`.

### Bitrate guide (H.265 VBR, kbps)
| Channel | Default | Range |
|---------|---------|-------|
| LONG 1080p30 | 6000 | 4000–8000 |
| WIDE 720p30 | 3000 | 2000–4000 |
| IR 640×512 | 2000 | 1000–3000 |

### IMediaRecorder
- `MockMediaRecorder` — demo index/markers
- Production side-car: FFmpeg `libx265` / `hevc_nvenc` / `hevc_qsv` on operator workstation (not turret disk)
- Fallback H.264 if H.265 encoder unavailable → SYSTEM_WARN

### Why not H.265 inside the browser
MediaRecorder HEVC support is incomplete across browsers. The HMI records an authoritative **index** synchronized to `t_mono_ms`; real bitstreams are produced by the workstation recorder.

## Media side-car (production)

```bash
cd sidecar && npm start   # http://127.0.0.1:8787
```

HMI: `resolveMediaRecorder()` → `HttpMediaRecorder` if `/caps` OK, else mock.

```bash
export STREAM_LONG=rtsp://...
export STREAM_WIDE=rtsp://...
export STREAM_IR=rtsp://...
```

Without URLs: FFmpeg `testsrc` lab patterns (real H.265 files still written).
