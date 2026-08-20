/// <reference types="vite/client" />

interface HlsInstance {
  loadSource(url: string): void
  attachMedia(media: HTMLMediaElement): void
  on(event: string, callback: (...args: unknown[]) => void): void
  destroy(): void
}

interface HlsConstructor {
  isSupported(): boolean
  new (config?: Record<string, unknown>): HlsInstance
  Events: {
    ERROR: string
    MANIFEST_PARSED: string
  }
}

interface Window {
  Hls?: HlsConstructor
}
