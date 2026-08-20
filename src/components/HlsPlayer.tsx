import { useEffect, useRef } from 'react'
import { isHlsUrl } from '../lib/streams'

type Props = {
  url: string
  className?: string
  style?: React.CSSProperties
  onFatalError?: () => void
  muted?: boolean
  /** Loop when stream is VOD (has ENDLIST) */
  loop?: boolean
}

/**
 * Stable HLS player. Effect depends ONLY on `url`.
 * Parent re-renders / show-hide must not change `url` or playback restarts.
 */
export function HlsPlayer({
  url,
  className,
  style,
  onFatalError,
  muted = true,
  loop = true,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<{ destroy: () => void; recoverMediaError?: () => void; startLoad?: () => void } | null>(null)
  const onFatalRef = useRef(onFatalError)
  onFatalRef.current = onFatalError

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return

    let destroyed = false
    const Hls = window.Hls

    if (hlsRef.current) {
      try { hlsRef.current.destroy() } catch { /* */ }
      hlsRef.current = null
    }

    const fail = () => {
      if (destroyed) return
      onFatalRef.current?.()
    }

    video.loop = loop

    if (isHlsUrl(url) && Hls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        backBufferLength: 15,
        manifestLoadingTimeOut: 15000,
        levelLoadingTimeOut: 15000,
        fragLoadingTimeOut: 20000,
        startLevel: -1,
      })
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (destroyed) return
        video.play().catch(() => {})
      })

      // VOD ended → loop manually if needed
      hls.on(Hls.Events.MEDIA_ENDED, () => {
        if (destroyed || !loop) return
        try {
          video.currentTime = 0
          hls.startLoad(0)
          video.play().catch(() => {})
        } catch { /* */ }
      })

      hls.on(Hls.Events.ERROR, (_evt: string, data: unknown) => {
        if (destroyed) return
        const d = data as { fatal?: boolean; type?: string }
        if (!d?.fatal) return
        if (d.type === 'mediaError') {
          try { hls.recoverMediaError(); return } catch { /* */ }
        }
        if (d.type === 'networkError') {
          try { hls.startLoad(); return } catch { /* */ }
        }
        fail()
      })
    } else if (isHlsUrl(url) && video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url
      const onMeta = () => { video.play().catch(() => {}) }
      const onErr = () => fail()
      video.addEventListener('loadedmetadata', onMeta)
      video.addEventListener('error', onErr)
      return () => {
        destroyed = true
        video.removeEventListener('loadedmetadata', onMeta)
        video.removeEventListener('error', onErr)
      }
    } else {
      video.src = url
      video.loop = true
      video.play().catch(() => {})
      const onErr = () => fail()
      video.addEventListener('error', onErr)
      return () => {
        destroyed = true
        video.removeEventListener('error', onErr)
      }
    }

    return () => {
      destroyed = true
      if (hlsRef.current) {
        try { hlsRef.current.destroy() } catch { /* */ }
        hlsRef.current = null
      }
    }
  }, [url, loop])

  return (
    <video
      ref={videoRef}
      className={className}
      style={style}
      muted={muted}
      autoPlay
      playsInline
    />
  )
}
