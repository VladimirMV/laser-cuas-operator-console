import { AnimatePresence, motion } from 'framer-motion'
import { useHmiStore } from '../store/useHmiStore'
import { cn } from '../lib/utils'

export function Toast() {
  const toast = useHmiStore((s) => s.toast)
  const clearToast = useHmiStore((s) => s.clearToast)

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] pointer-events-auto"
        >
          <button
            onClick={clearToast}
            className={cn(
              'px-4 py-2 rounded border font-mono text-xs shadow-lg',
              toast.level === 'error'
                ? 'bg-[#F85149]/20 border-[#F85149] text-[#F85149]'
                : toast.level === 'warn'
                  ? 'bg-[#D29922]/20 border-[#D29922] text-[#D29922]'
                  : 'bg-[#161B22] border-[#30363D] text-[#E6EDF3]'
            )}
          >
            {toast.text}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
