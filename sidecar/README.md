# Laser C-UAS Media Side-car

Окремий процес на **ПК оператора**: запис LONG / WIDE / IR у **H.265** (fallback H.264) через FFmpeg.

Відео **ніколи** не пишеться на диск турелі. Кільцевий буфер і сегменти — тільки NVMe робочої станції.

## Вимоги

- Node.js ≥ 18
- FFmpeg з `libx265` (і бажано `libx264`)

```bash
ffmpeg -encoders | grep -E 'libx265|libx264'
```

## Запуск

```bash
cd sidecar
# опційно: прописати RTSP у config.json або env
export STREAM_LONG="rtsp://192.168.1.10/stream1"
export STREAM_WIDE="rtsp://192.168.1.11/stream1"
export STREAM_IR="rtsp://192.168.1.12/stream1"

npm start
# → http://127.0.0.1:8787
```

Без URL каналів side-car пише **testsrc** (лабораторія) — реальні MP4 з’являються на диску.

## API

| Method | Path | Опис |
|--------|------|------|
| GET | `/health` | живий сервіс |
| GET | `/caps` | h265/h264/hw, які канали сконфігуровані |
| GET | `/status` | чи йде REC |
| POST | `/record/start` | `{ sessionId, channels, codec, segmentDurationSec, bitrates }` |
| POST | `/record/stop` | зупинка, rename сегментів `t{mono}`, список у `media_index.jsonl` |
| POST | `/snapshot` | `{ channel, triggerEventId?, label? }` → JPEG |
| GET | `/media/...` | віддача файлів з `mediaRoot` |

## Вихідні файли

```
media/{sessionId}/
  media/long/seg_0000_t000000_h265.mp4
  media/wide/...
  media/ir/...
  media/snapshots/{t_mono}_{EVENT}_{CH}.jpg
  media/clips/ENG-{id}_T-15_T+25_long.mp4
  media_index.jsonl

media/ring/{long|wide|ir}/
  always-on 90 s fMP4 preroll (NVMe workstation, not NAS, not turret disk)
```

FFmpeg під час REC пише `seg_%04d_h265.mp4`. На `/record/stop` файли **перейменовуються** в
`seg_{nnnn}_t{idx * segmentDurationSec * 1000 padded}_h265.mp4` і ці імена потрапляють у `media_index.jsonl`.

`ring/` — каталог під 90-секундне кільце (preroll −15 s на REC_START). HMI 1.8.0 приєднує preroll MediaRefs у індекс; сам кільцевий запис — обов’язок sidecar на NVMe.

## HMI

У консолі оператора `HttpMediaRecorder` стукає на `VITE_SIDECAR_URL` (default `http://127.0.0.1:8787`).  
Якщо side-car недоступний — fallback на `MockMediaRecorder` (meta-only).
