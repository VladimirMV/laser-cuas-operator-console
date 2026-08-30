import { useHmiStore } from '../store/useHmiStore'
import { translations, type TranslationKey, type Lang } from './translations'

/**
 * i18n hook. Subscribes to store.lang so every consumer re-renders on switch.
 * Dictionary is resolved inside t() to avoid any stale closure.
 */
export function useT() {
  const lang = useHmiStore((s) => s.lang) as Lang

  const t = (key: TranslationKey): string => {
    const dict = (lang === 'ua' ? translations.ua : translations.en) as Record<string, string>
    const v = dict[key] ?? (translations.en as Record<string, string>)[key]
    return v != null && v !== '' ? v : String(key)
  }

  return { t, lang }
}
