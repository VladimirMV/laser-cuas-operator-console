import { useHmiStore } from '../store/useHmiStore'
import { translations, type TranslationKey } from './translations'

export function useT() {
  const lang = useHmiStore((s) => s.lang)
  const t = (key: TranslationKey): string => translations[lang][key] ?? translations.en[key] ?? key
  return { t, lang }
}
