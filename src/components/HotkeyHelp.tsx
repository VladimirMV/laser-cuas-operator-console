import { Keyboard } from 'lucide-react'
import { HOTKEY_ROWS } from '../hooks/useHotkeys'
import { useT } from '../i18n/useT'
import type { TranslationKey } from '../i18n/translations'

export function HotkeyHelp({ onClose }: { onClose: () => void }) {
  const { t } = useT()

  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-md shadow-2xl">
        <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[#58A6FF]" />
            <h2 className="text-base font-semibold">{t('hotkeysTitle')}</h2>
          </div>
          <button onClick={onClose} className="text-[#8B949E] hover:text-[#E6EDF3] text-sm font-mono px-2">
            ✕
          </button>
        </div>
        <div className="px-5 py-3 max-h-[60vh] overflow-y-auto">
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
        </div>
        <div className="px-5 py-3 border-t border-[#30363D] text-[10px] text-[#8B949E] font-mono">
          {t('hotkeysHint')}
        </div>
      </div>
    </div>
  )
}
