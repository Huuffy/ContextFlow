import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserPlus, X, CheckCircle, Loader2, Mail, Phone, Send, Users } from 'lucide-react'
import { register } from '../services/api'

function Field({ id, label, placeholder, value, onChange, icon, type = 'text' }: {
  id: string; label: string; placeholder: string; value: string
  onChange: (v: string) => void; icon: React.ReactNode; type?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-teal-300/70 mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500/60" aria-hidden="true">{icon}</span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 border border-teal-500/20 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-teal-200/30 focus:outline-none focus:border-teal-400/60 focus:ring-1 focus:ring-teal-400/30 transition-colors"
        />
      </div>
    </div>
  )
}

export function RegisterModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ email: '', name: '', whatsapp: '', telegram: '' })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr]   = useState('')

  const submit = async () => {
    if (!form.email.trim()) { setErr('Email is required'); return }
    setBusy(true); setErr('')
    try {
      await register({
        email:    form.email.trim(),
        name:     form.name.trim()     || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        telegram: form.telegram.trim() || undefined,
      })
      setDone(true)
    } catch {
      setErr('Registration failed — please try again')
    } finally { setBusy(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,27,26,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-modal-title"
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-md rounded-3xl border border-teal-500/30 bg-[#0a2928] shadow-2xl shadow-teal-900/50 p-8"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 flex items-center justify-center" aria-hidden="true">
                <UserPlus className="w-4 h-4 text-teal-400" />
              </div>
              <h2 id="register-modal-title" className="text-lg font-bold text-white">Stay Connected</h2>
            </div>
            <p className="text-sm text-teal-200/60">Register to receive NeoBank campaign messages</p>
          </div>
          <button onClick={onClose} aria-label="Close registration form" className="text-teal-400/60 hover:text-teal-300 transition-colors">
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-6"
          >
            <CheckCircle className="w-14 h-14 text-teal-400 mx-auto mb-3" />
            <p className="text-white font-semibold text-lg">You're registered!</p>
            <p className="text-teal-200/60 text-sm mt-1">
              You'll receive NeoBank updates on your provided channels.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-teal-500 hover:bg-teal-400 rounded-xl text-sm font-semibold text-white transition-colors"
            >
              Done
            </button>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <Field id="reg-email" label="Email *" type="email" placeholder="you@example.com"
              value={form.email} onChange={(v) => setForm({ ...form, email: v })}
              icon={<Mail className="w-4 h-4" />} />
            <Field id="reg-name" label="Name" placeholder="Your name (optional)"
              value={form.name} onChange={(v) => setForm({ ...form, name: v })}
              icon={<Users className="w-4 h-4" />} />
            <Field id="reg-whatsapp" label="WhatsApp" placeholder="+91 98765 43210 (optional)"
              value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })}
              icon={<Phone className="w-4 h-4" />} />
            <Field id="reg-telegram" label="Telegram" placeholder="Chat ID or @username (optional)"
              value={form.telegram} onChange={(v) => setForm({ ...form, telegram: v })}
              icon={<Send className="w-4 h-4" />} />

            {err && <p role="alert" className="text-red-400 text-xs">{err}</p>}

            <button
              onClick={submit}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg shadow-teal-500/30 transition-colors mt-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Register
            </button>
            <p className="text-[11px] text-teal-200/40 text-center">
              Your details are only used to send you NeoBank communications.
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

export function RegisterModalWrapper({ show, onClose }: { show: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {show && <RegisterModal onClose={onClose} />}
    </AnimatePresence>
  )
}
