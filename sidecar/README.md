# Laser C-UAS Media Side-car 1.8.1

Пише **реальні файли** LONG / WIDE / IR на NVMe робочої станції (не диск турелі).

## Запуск

```bash
cd sidecar
npm install          # optional: ffmpeg-static if system ffmpeg missing
npm start            # http://127.0.0.1:8787
```

Windows: `..\start-sidecar.ps1` з кореня проєкту.

У лозі шукайте `mediaRoot=` — це каталог файлів.

## Куди пишеться

```
sidecar/media/
  ring/{long,wide,ir}/r_00.mp4 …     # 90 с завжди
  {sessionId}/media/{long,wide,ir}/
    preroll/preroll_00_t000000.mp4   # −15 с з кільця на REC
    seg_0000_t000000_h265.mp4
  {sessionId}/media/snapshots/
  {sessionId}/media/clips/
  {sessionId}/media_index.jsonl
```

Перевизначити: env `MEDIA_ROOT` або `config.json` → `mediaRoot`.

Камери: `STREAM_LONG` / `STREAM_WIDE` / `STREAM_IR` або `config.channels.*.url`.  
Порожній URL → lab MP4 (loop) → якщо мережа недоступна, FFmpeg впаде на канал; поставте `"url": "testsrc"` для гарантованого лабораторного візерунка (файл усе одно реальний).

## HMI

Другий термінал: `npm run dev` або `node serve-dist.mjs`.  
HMI стукає на `VITE_SIDECAR_URL` (default `http://127.0.0.1:8787`). REC тоді пише дискові сегменти; чіп RING 90s горить, коли кільце живе. Без sidecar — meta-only.

FFmpeg: `FFMPEG_PATH` → `config.ffmpegPath` → `ffmpeg-static` → `ffmpeg` у PATH.
