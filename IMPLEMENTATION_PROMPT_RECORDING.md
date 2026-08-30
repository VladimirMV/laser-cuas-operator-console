# Laser C-UAS HMI 1.8.1 — Real stream recording (workstation sidecar)

## Goal

Operator workstation must **write real video files** for LONG / WIDE / IR. The browser HMI stays the index + replay UI. Encode is **never** in Chrome (no HEVC MediaRecorder). Files live on **workstation NVMe**, never on the turret disk.

This prompt is the spec. Implement it on top of HMI 1.8.0 without touching the laser safety chain, Panoptes adapters, calibration, BITE, gamepad, or i18n structure (add keys only).

---

## Layout (authoritative)

```
{mediaRoot}/                              # default: sidecar/media
  ring/{long|wide|ir}/
    r_00.mp4 … r_14.mp4                   # 6 s × 15 = 90 s wrap, always-on
  {sessionId}/
    media/{long|wide|ir}/
      preroll/preroll_{nn}_t{mono}.mp4    # copy from ring at REC_START (−15 s)
      seg_{nnnn}_t{mono}_{codec}.mp4      # session segments
    media/snapshots/{t_mono}_{EVENT}_{CH}.jpg
    media/clips/ENG-{id}_T-15_T+25_{ch}.mp4
    media_index.jsonl                     # one JSON object per line
```

`mediaRoot` = `sidecar/config.json` → `mediaRoot` (default `./media`) or env `MEDIA_ROOT`. Sidecar logs the absolute path at boot. HMI SYS dock / REC tooltip shows that path when sidecar is up.

---

## Sources (priority)

1. `STREAM_LONG` / `STREAM_WIDE` / `STREAM_IR` env, else `config.channels.{CH}.url`
2. If URL is RTSP → `-rtsp_transport tcp`
3. If URL is `http(s)` / file → `-stream_loop -1 -re -i`
4. Empty / `testsrc` → lavfi `testsrc` at channel geometry (lab still writes **real** MP4)

Channel geometry: LONG 1920×1080@30, WIDE 1280×720@30, IR 640×512@30.

---

## Ring (always-on)

On sidecar boot, spawn **one FFmpeg per channel** into `ring/{ch}/`:

- 6 s segments, `-segment_wrap 15` (90 s)
- Encoder: `libx264 -preset ultrafast` (preroll is a copy, not the archive master)
- Do not stop the ring during session REC
- `/status.ringHot = true` when all three ring processes are alive
- When copying preroll, **skip the currently-open** (newest) segment

On `POST /record/start`:

- Copy last `ceil(prerollSec / 6)` closed ring files into `session/media/{ch}/preroll/`
- Attach MediaRefs (`kind: SEGMENT`, label `PREROLL {ch} −15s from ring`, `url` playable)
- Then start session FFmpeg into `media/{ch}/seg_%04d_{codec}.mp4`

---

## Session REC

`POST /record/start` `{ sessionId, channels[], codec, segmentDurationSec, bitrates, prerollSec }`

- Codec target h265 → `libx265` / `hevc_nvenc` if `preferHw`; fallback `libx264` and set `codec_actual`
- GOP = segmentDurationSec × fps, `scenecut=0` for clean cuts
- `-f segment -segment_time {segmentDurationSec} -reset_timestamps 1`
- On `POST /record/stop`: SIGINT, wait flush, **rename** `seg_%04d_{codec}.mp4` → `seg_{nnnn}_t{idx*segDur*1000}_{codec}.mp4`, append `media_index.jsonl`, return refs with `url: /media/{rel}`

`POST /snapshot` `{ channel, triggerEventId, label, sessionId }` → JPEG under `media/snapshots/`.

`POST /clip` `{ sessionId, channel, tStartMs, tEndMs, label }` → ffmpeg concat/cut into `media/clips/`, return CLIP MediaRef. Used by **Export ENG T−15…T+25**.

---

## HTTP (sidecar :8787)

| Method | Path | |
|--------|------|--|
| GET | `/health` | liveness |
| GET | `/caps` | h265/h264/hw, ffmpeg bin, mediaRoot, ringHot |
| GET | `/status` | recording session + ring + disk bytes |
| GET | `/sessions` | list session folders + file counts |
| POST | `/record/start` `/record/stop` | |
| POST | `/snapshot` `/clip` | |
| GET | `/media/*` | static + **HTTP Range** (required for `<video>` seek) |

CORS `*`. `Accept-Ranges: bytes`. Never bind turret storage.

Binary: `FFMPEG_PATH` → `config.ffmpegPath` → `ffmpeg-static` → `ffmpeg` on PATH.

---

## HMI

- Boot: `resolveMediaRecorder()`. If `/caps` ok → `HttpMediaRecorder`, else meta mock (toast once).
- Poll `/status` every 4 s → `ringHot`, `sidecarConnected`, `mediaRoot`.
- REC chip: `h265`/`h264` when sidecar; `META` only when mock.
- `MediaRef.url` = `http://127.0.0.1:8787/media/...`. Archive replay: `<video>` under HUD canvas; seek `currentTime = (playhead - ref.t_mono_ms)/1000`. If no url, keep synthetic ReplayCanvas.
- Do **not** dual-write synthetic preroll when sidecar already returned preroll refs.
- Export clip: POST `/clip`; fallback JSON descriptor if sidecar down.
- Replay remains visual-only (no PTZ / laser / effector).

---

## Invariants (do not break)

- FIRE/ARM immutable; laser SAFE → ARM → hold-to-FIRE; Esc = SAFE
- Four archive streams stay separate (events / telemetry / media / config)
- `t_mono_ms` is master clock; filenames carry `t{mono}`
- EN + UA keys only; no new locale
- Live preview / Vite `base: './'` unchanged

## Done when

1. `cd sidecar && npm start` prints `mediaRoot=` absolute path and `ringHot=true`
2. After 10 s, `media/ring/long/` contains wrapping mp4s with size > 0
3. HMI REC → files appear under `media/{sessionId}/media/{ch}/` including preroll copy
4. STOP → renamed `seg_*_t*_h265.mp4` (or h264 fallback) + `media_index.jsonl`
5. Archive player plays those files via Range-enabled `/media/`
6. FIRE snapshot JPEG on disk; Export ENG writes a real clip when sidecar is up
