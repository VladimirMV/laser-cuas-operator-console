import { useEffect } from 'react'
import { Keyboard } from 'lucide-react'
import { HOTKEY_ROWS } from '../hooks/useHotkeys'
import { useT } from '../i18n/useT'
import type { TranslationKey } from '../i18n/translations'

export function HotkeyHelp({ onClose }: { onClose: () => void }) {
  const { t } = useT()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-md max-h-[min(88vh,640px)] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[#30363D] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[#58A6FF]" />
            <h2 className="text-base font-semibold">{t('hotkeysTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8B949E] hover:text-[#E6EDF3] text-sm font-mono px-2 py-1 rounded border border-transparent hover:border-[#30363D]"
            title="Esc"
          >
            ✕ Esc
          </button>
        </div>
        <div className="px-5 py-3 overflow-y-auto min-h-0 flex-1">
          <table className="w-full text-xs font-mono">
            <tbody>
              {HOTKEY_ROWS.map((row) => (
                <tr key={row.keys} className="border-b border-[#21262D]">
                  <td className="py-1.5 pr-3 text-[#3FB950] whitespace-nowrap font-semibold">{row.keys}</td>
                  <td className="py-1.5 text-[#E6EDF3]">{t(row.actionKey as TranslationKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 text-xs font-semibold text-[#58A6FF] mb-2 font-mono">{t('padHelpTitle')}</div>
          <ul className="text-[11px] font-mono text-[#E6EDF3] space-y-1">
            <li>{t('padHelpStick')}</li>
            <li>{t('padHelpRS')}</li>
            <li>{t('padHelpDpad')}</li>
            <li>{t('padHelpLT')}</li>
            <li>{t('padHelpRT')}</li>
            <li>{t('padHelpL3')}</li>
            <li>{t('padHelpR3')}</li>
            <li>{t('padHelpView')}</li>
            <li>{t('padHelpLB')}</li>
            <li>{t('padHelpRB')}</li>
            <li>{t('padHelpB')}</li>
            <li>{t('padHelpA')}</li>
            <li>{t('padHelpX')}</li>
            <li>{t('padHelpY')}</li>
          </ul>
        </div>
        <div className="px-5 py-2.5 border-t border-[#30363D] shrink-0 flex items-center justify-between">
          <div className="text-[10px] text-[#8B949E] font-mono">{t('hotkeysHint')}</div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded border border-[#30363D] text-[11px] font-mono text-[#E6EDF3] hover:border-[#58A6FF]"
          >
            Esc
          </button>
        </div>
      </div>
    </div>
  )
}
