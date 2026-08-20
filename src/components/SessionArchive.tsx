import { Archive, Circle, Download } from 'lucide-react'
import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { cn } from '../lib/utils'

export function SessionArchive() {
  const {
    sessions, closeSessions, recording, toggleRecording,
    eventLog, selectedSessionId, selectSession,
    exportEventLogJson, exportEventLogCsv,
  } = useHmiStore()
  const { t } = useT()

  const fmtDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const selected = sessions.find((s) => s.id === selectedSessionId)
  const timeline = selected ? selected.eventLog : eventLog

  const download = (kind: 'json' | 'csv') => {
    const data = kind === 'json' ? exportEventLogJson() : exportEventLogCsv()
    const blob = new Blob([data], { type: kind === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `event-log.${kind}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-3xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-[#30363D] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-[#58A6FF]" />
            <div>
              <h2 className="text-base font-semibold">{t('sessions')}</h2>
              <p className="text-xs text-[#8B949E]">{t('sessionsSub')}</p>
            </div>
          </div>
          <button onClick={closeSessions} className="text-[#8B949E] hover:text-[#E6EDF3] font-mono px-2">
            ✕
          </button>
        </div>

        <div className="px-5 py-2 border-b border-[#30363D] flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={toggleRecording}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-mono font-semibold',
              recording
                ? 'border-[#F85149] text-[#F85149] bg-[#F85149]/10 animate-pulse'
                : 'border-[#30363D] text-[#8B949E] hover:border-[#F85149]/50'
            )}
          >
            <Circle size={10} fill={recording ? '#F85149' : 'transparent'} />
            {recording ? t('stopRec') : t('startRec')}
          </button>
          <button
            onClick={() => download('json')}
            className="flex items-center gap-1 px-2 py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            <Download size={11} /> JSON
          </button>
          <button
            onClick={() => download('csv')}
            className="flex items-center gap-1 px-2 py-1.5 rounded border border-[#30363D] text-[10px] font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            <Download size={11} /> CSV
          </button>
          <span className="text-[10px] text-[#8B949E] font-mono ml-auto">{t('eventLogAlways')}</span>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Session list */}
          <div className="w-2/5 border-r border-[#30363D] overflow-y-auto">
            <table className="w-full text-xs font-mono">
              <thead className="sticky top-0 bg-[#161B22]">
                <tr className="text-[#8B949E] border-b border-[#30363D]">
                  <th className="py-2 px-3 text-left">{t('sessionId')}</th>
                  <th className="py-2 px-2 text-right">{t('events')}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  className={cn(
                    'border-b border-[#21262D] cursor-pointer',
                    !selectedSessionId ? 'bg-[#0D1117]' : 'hover:bg-[#0D1117]'
                  )}
                  onClick={() => selectSession(null)}
                >
                  <td className="py-2 px-3">
                    <div className="text-[#58A6FF]">{t('liveLog')}</div>
                    <div className="text-[#8B949E] text-[10px]">{eventLog.length} events</div>
                  </td>
                  <td className="py-2 px-2 text-right text-[#E6EDF3]">{eventLog.length}</td>
                </tr>
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => selectSession(s.id)}
                    className={cn(
                      'border-b border-[#21262D] cursor-pointer',
                      selectedSessionId === s.id ? 'bg-[#0D1117]' : 'hover:bg-[#0D1117]'
                    )}
                  >
                    <td className="py-2 px-3">
                      <div className="text-[#E6EDF3]">{s.id}</div>
                      <div className="text-[#8B949E] text-[10px]">
                        {s.note} · {fmtDur(s.durationSec)}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right text-[#E6EDF3]">{s.events}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            <div className="text-[10px] text-[#8B949E] font-mono tracking-wider mb-2">
              {t('timeline')} {selected ? selected.id : t('liveLog')}
            </div>
            <div className="space-y-1">
              {timeline.length === 0 && (
                <div className="text-xs text-[#8B949E] py-6 text-center">{t('noEvents')}</div>
              )}
              {timeline.map((e) => (
                <div
                  key={e.id}
                  className="flex gap-2 text-[11px] font-mono border-b border-[#21262D] py-1.5"
                >
                  <span className="text-[#6E7681] shrink-0 w-[72px]">
                    {e.ts.slice(11, 19)}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 w-[90px] font-semibold',
                      e.type.startsWith('FIRE') || e.type === 'TRACK_LOST'
                        ? 'text-[#F85149]'
                        : e.type === 'ARM'
                          ? 'text-[#D29922]'
                          : e.type === 'SAFE'
                            ? 'text-[#3FB950]'
                            : 'text-[#58A6FF]'
                    )}
                  >
                    {e.type}
                  </span>
                  <span className="text-[#E6EDF3] truncate flex-1">{e.message}</span>
                  <span className="text-[#6E7681] shrink-0">{e.source}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#30363D] flex justify-end shrink-0">
          <button
            onClick={closeSessions}
            className="px-4 py-2 rounded border border-[#30363D] text-sm font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
