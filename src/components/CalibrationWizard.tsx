import { useHmiStore } from '../store/useHmiStore'
import { useT } from '../i18n/useT'
import { fitParallax, cn } from '../lib/utils'
import type { CalMeasurement } from '../types/hmi'
import type { TranslationKey } from '../i18n/translations'

const RANGE_TABLE = [100, 200, 500, 1500, 2000, 3000, 5000]

function syntheticMeasurement(range: number): CalMeasurement {
  const noise = () => (Math.random() - 0.5) * 0.04
  return {
    range,
    du: -0.4 + 800 / range + noise(),
    dv: 0.15 - 300 / range + noise(),
  }
}

const STEP_KEYS: { title: TranslationKey; desc: TranslationKey }[] = [
  { title: 'step0', desc: 'step0desc' },
  { title: 'step1', desc: 'step1desc' },
  { title: 'step2', desc: 'step2desc' },
  { title: 'step3', desc: 'step3desc' },
  { title: 'step4', desc: 'step4desc' },
  { title: 'step5', desc: 'step5desc' },
]

export function CalibrationWizard() {
  const {
    calStep, calMeasurements, nextCalStep, prevCalStep,
    addCalMeasurement, finishCalibration, cancelCalibration,
  } = useHmiStore()
  const { t } = useT()

  const fit = calMeasurements.length >= 2 ? fitParallax(calMeasurements) : null

  const addNextRange = () => {
    const used = new Set(calMeasurements.map((m) => m.range))
    const next = RANGE_TABLE.find((r) => !used.has(r))
    if (next) addCalMeasurement(syntheticMeasurement(next))
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-[#30363D] flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{t('calTitle')}</h2>
            <p className="text-xs text-[#8B949E] mt-0.5">{t('calFormula')}</p>
          </div>
          <button onClick={cancelCalibration} className="text-[#8B949E] hover:text-[#E6EDF3] text-sm font-mono px-2">
            ✕
          </button>
        </div>

        <div className="px-5 pt-3 flex gap-1">
          {STEP_KEYS.map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded', i <= calStep ? 'bg-[#3FB950]' : 'bg-[#30363D]')} />
          ))}
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <div className="text-sm font-semibold text-[#E6EDF3]">{t(STEP_KEYS[calStep].title)}</div>
            <div className="text-xs text-[#8B949E] mt-1">{t(STEP_KEYS[calStep].desc)}</div>
          </div>

          {calStep === 2 && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-[#8B949E]">
                  {t('measurements')}: {calMeasurements.length} / {RANGE_TABLE.length}
                </span>
                <button
                  onClick={addNextRange}
                  disabled={calMeasurements.length >= RANGE_TABLE.length}
                  className="text-xs font-mono px-2 py-1 rounded border border-[#30363D] text-[#3FB950] hover:border-[#3FB950] disabled:opacity-40"
                >
                  {t('addPoint')}
                </button>
              </div>
              <div className="bg-[#0D1117] rounded border border-[#30363D] overflow-hidden">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-[#8B949E] border-b border-[#30363D]">
                      <th className="py-1.5 px-2 text-left">R, m</th>
                      <th className="py-1.5 px-2 text-right">Δu, mrad</th>
                      <th className="py-1.5 px-2 text-right">Δv, mrad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calMeasurements.map((m) => (
                      <tr key={m.range} className="border-b border-[#21262D]">
                        <td className="py-1 px-2">{m.range}</td>
                        <td className="py-1 px-2 text-right">{m.du.toFixed(3)}</td>
                        <td className="py-1 px-2 text-right">{m.dv.toFixed(3)}</td>
                      </tr>
                    ))}
                    {calMeasurements.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-3 text-center text-[#8B949E]">
                          {t('noMeasurements')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(calStep === 3 || calStep === 4) && (
            <div className="bg-[#0D1117] rounded border border-[#30363D] p-3 font-mono text-xs space-y-1.5">
              {fit ? (
                <>
                  <div className="flex justify-between"><span className="text-[#8B949E]">a (X)</span><span>{fit.a.toFixed(4)} mrad</span></div>
                  <div className="flex justify-between"><span className="text-[#8B949E]">c (X)</span><span>{fit.c.toFixed(1)} mrad·m</span></div>
                  <div className="flex justify-between"><span className="text-[#8B949E]">d (Y)</span><span>{fit.d.toFixed(4)} mrad</span></div>
                  <div className="flex justify-between"><span className="text-[#8B949E]">e (Y)</span><span>{fit.e.toFixed(1)} mrad·m</span></div>
                  <div className="flex justify-between pt-1 border-t border-[#30363D]">
                    <span className="text-[#8B949E]">RMS</span>
                    <span className={fit.rms <= 0.15 ? 'text-[#3FB950]' : fit.rms <= 0.25 ? 'text-[#D29922]' : 'text-[#F85149]'}>
                      {fit.rms.toFixed(3)} mrad {fit.rms <= 0.25 ? '✓' : '✗'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-[#8B949E]">{t('noMeasurements')}</div>
              )}
            </div>
          )}

          {calStep === 5 && fit && (
            <div className="text-xs font-mono">
              <p className={fit.rms <= 0.25 ? 'text-[#3FB950]' : 'text-[#D29922]'}>
                RMS = {fit.rms.toFixed(3)} mrad — {fit.rms <= 0.25 ? t('accepted') : t('needsCheck')}
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#30363D] flex justify-between gap-2">
          <button
            onClick={calStep === 0 ? cancelCalibration : prevCalStep}
            className="px-4 py-2 rounded border border-[#30363D] text-sm font-mono text-[#8B949E] hover:border-[#8B949E]"
          >
            {calStep === 0 ? t('cancel') : t('back')}
          </button>

          {calStep < 5 ? (
            <button
              onClick={nextCalStep}
              disabled={calStep === 2 && calMeasurements.length < 3}
              className="px-4 py-2 rounded border border-[#3FB950]/50 bg-[#3FB950]/10 text-sm font-mono text-[#3FB950] hover:bg-[#3FB950]/20 disabled:opacity-40"
            >
              {t('next')}
            </button>
          ) : (
            <button
              onClick={finishCalibration}
              className="px-4 py-2 rounded border border-[#3FB950] bg-[#3FB950]/15 text-sm font-mono text-[#3FB950] hover:bg-[#3FB950]/25"
            >
              {t('saveExit')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
