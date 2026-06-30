import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Wifi, WifiOff } from 'lucide-react'

const HEALTH_URL = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/api\/v1\/?$/, '/health')
const POLL_MS = 1000
const HINT_AFTER_MS = 4000   // show the "20 sec" hint after 4s of waiting

async function ping(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { method: 'GET', cache: 'no-store' })
    return res.ok
  } catch {
    return false
  }
}

export default function BackendGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const ok = await ping()
      if (cancelled) return
      if (ok) {
        setReady(true)
        return
      }
      setAttempts((n) => n + 1)
      timerRef.current = setTimeout(check, POLL_MS)
    }

    check()

    hintTimerRef.current = setTimeout(() => {
      if (!cancelled) setShowHint(true)
    }, HINT_AFTER_MS)

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current)
    }
  }, [])

  return (
    <>
      <AnimatePresence>
        {!ready && (
          <motion.div
            key="backend-gate"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-[#021b1a] via-[#042f2e] to-[#063330] text-white"
          >
            {/* Animated orb */}
            <motion.div
              aria-hidden="true"
              className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none"
              style={{ background: 'rgba(13,148,136,0.2)' }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="relative flex flex-col items-center gap-5"
            >
              <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shadow-xl shadow-teal-500/20">
                <MessageSquare className="w-8 h-8 text-teal-400" />
              </div>

              <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">ContextFlow</h1>
                <p className="text-teal-300/60 text-sm mt-1">NeoBank Support Platform</p>
              </div>

              {/* Spinner + status */}
              <div className="flex flex-col items-center gap-3 mt-2" role="status" aria-live="polite" aria-label="Connecting to backend">
                <div className="flex items-center gap-2.5 text-teal-300/80 text-sm">
                  <motion.div
                    aria-hidden="true"
                    className="w-4 h-4 border-2 border-teal-400 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  <span>Connecting to backend</span>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={attempts % 4}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-teal-400 font-mono w-4 text-left"
                    >
                      {'.'.repeat((attempts % 3) + 1)}
                    </motion.span>
                  </AnimatePresence>
                </div>

                {/* Dot pulse row */}
                <div className="flex gap-1.5" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-teal-500"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1.2, delay: i * 0.15, repeat: Infinity }}
                    />
                  ))}
                </div>

                {/* Retry counter */}
                {attempts > 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-teal-600 text-xs font-mono"
                  >
                    {attempts}s elapsed
                  </motion.p>
                )}
              </div>

              {/* Hint card */}
              <AnimatePresence>
                {showHint && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mt-3 flex items-start gap-3 px-5 py-4 rounded-2xl border border-teal-500/20 bg-teal-500/8 backdrop-blur-sm max-w-xs text-center"
                  >
                    <div className="flex flex-col items-center gap-1 w-full">
                      <div className="flex items-center gap-2 text-teal-300 text-sm font-medium">
                        <Wifi className="w-4 h-4" />
                        Cloud instance is waking up
                      </div>
                      <p className="text-teal-400/70 text-xs leading-relaxed mt-1">
                        Google Cloud Run spins down idle containers to save resources.
                        Cold starts typically take <span className="text-teal-300 font-semibold">15–25 seconds</span> — hang tight!
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-teal-500">
                        <WifiOff className="w-3 h-3" />
                        Retrying every second automatically
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Render children immediately — they're hidden behind the gate overlay */}
      {children}
    </>
  )
}
