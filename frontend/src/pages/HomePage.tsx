import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  MessageSquare, Shield, BarChart3, Globe, Users,
  ArrowRight, Mail, Phone, AtSign, Send, Bot, Layers, Zap,
  UserPlus,
} from 'lucide-react'
import { RegisterModalWrapper } from '../components/RegisterModal'

const STAR_COUNT = 80

function StarField() {
  const stars = useRef(
    Array.from({ length: STAR_COUNT }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      duration: Math.random() * 4 + 3,
      delay: Math.random() * 5,
    }))
  ).current

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
          }}
          animate={{ opacity: [0.1, 0.9, 0.1], scale: [1, 1.4, 1] }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

const FLOATING_ORBS = [
  { cx: '10%', cy: '20%', size: 400, color: 'rgba(13,148,136,0.18)', dur: 8 },
  { cx: '80%', cy: '10%', size: 300, color: 'rgba(20,184,166,0.12)', dur: 12 },
  { cx: '60%', cy: '70%', size: 500, color: 'rgba(6,95,70,0.25)', dur: 10 },
  { cx: '20%', cy: '80%', size: 250, color: 'rgba(5,150,105,0.15)', dur: 7 },
]

function FloatingOrbs() {
  return (
    <>
      {FLOATING_ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-3xl pointer-events-none"
          style={{
            left: orb.cx,
            top: orb.cy,
            width: orb.size,
            height: orb.size,
            background: orb.color,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </>
  )
}

const features = [
  {
    icon: <Globe className="w-6 h-6" />,
    title: 'Omni-Channel Inbox',
    desc: 'WhatsApp, Instagram, Email, Telegram — unified in one conversation thread. Customers never repeat themselves.',
  },
  {
    icon: <Bot className="w-6 h-6" />,
    title: 'AI-Powered Summaries',
    desc: 'Azure GPT-4o auto-generates concise one-liners and full summaries with key issues and suggested actions.',
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Real-Time Updates',
    desc: 'WebSocket push delivers new messages and AI summaries instantly. Sub-500ms from webhook to agent screen.',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Compliance Engine',
    desc: 'Built-in DNC checks and consent verification. Every outbound message passes compliance before dispatch.',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Analytics Dashboard',
    desc: 'KPI cards, channel breakdown, volume trends, and sentiment distribution — all in one glance.',
  },
  {
    icon: <Layers className="w-6 h-6" />,
    title: 'Smart Campaigns',
    desc: 'Target customers by transaction history. Audience segmentation, template variables, multi-channel dispatch.',
  },
]

const TELEGRAM_BOT_URL = 'https://t.me/ContextFlow_support_bot'

const channels = [
  { icon: <Phone className="w-4 h-4" />, label: 'WhatsApp', color: 'bg-green-500/20 text-green-300 border-green-500/30', href: null },
  { icon: <AtSign className="w-4 h-4" />, label: 'Instagram', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30', href: null },
  { icon: <Mail className="w-4 h-4" />, label: 'Email', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', href: 'mailto:neobanksupport@gmail.com' },
  { icon: <Send className="w-4 h-4" />, label: 'Telegram', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30', href: TELEGRAM_BOT_URL },
]

const pages = [
  { label: 'Inbox', path: '/inbox', icon: <MessageSquare className="w-4 h-4" /> },
  { label: 'Campaigns', path: '/campaigns', icon: <Globe className="w-4 h-4" /> },
  { label: 'Compliance', path: '/compliance', icon: <Shield className="w-4 h-4" /> },
  { label: 'Analytics', path: '/analytics', icon: <BarChart3 className="w-4 h-4" /> },
]

export default function HomePage() {
  const navigate = useNavigate()
  const [showRegister, setShowRegister] = useState(false)

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#021b1a] via-[#042f2e] to-[#063330] overflow-hidden text-white">
      <RegisterModalWrapper show={showRegister} onClose={() => setShowRegister(false)} />
      <StarField />
      <FloatingOrbs />

      {/* Nav */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">ContextFlow</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {pages.map((p) => (
            <button
              key={p.path}
              onClick={() => navigate(p.path)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-teal-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/inbox')}
          className="flex items-center gap-2 px-5 py-2 bg-teal-500 hover:bg-teal-400 rounded-xl text-sm font-semibold shadow-lg shadow-teal-500/30 transition-colors"
        >
          Open Dashboard <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-16 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-teal-500/40 bg-teal-500/10 text-teal-300 text-sm font-medium mb-8"
        >
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          idea 2.0 Hackathon 2026 — Team CloudCompute
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight"
        >
          One Inbox.{' '}
          <span className="bg-gradient-to-r from-teal-300 via-teal-400 to-emerald-300 bg-clip-text text-transparent">
            Every Channel.
          </span>
          <br />
          Zero Repetition.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-6 text-lg md:text-xl text-teal-100/70 max-w-2xl leading-relaxed"
        >
          ContextFlow unifies WhatsApp, Instagram, Email, and Telegram into a single AI-powered
          support platform for India's banking sector. Agents see the full customer journey — always.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="mt-10"
        >
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(20,184,166,0.35)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-2.5 px-8 py-4 rounded-2xl text-base font-bold transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(20,184,166,0.15) 0%, rgba(16,185,129,0.1) 100%)',
              border: '1.5px solid rgba(20,184,166,0.5)',
              color: '#5eead4',
              boxShadow: '0 0 0 1px rgba(20,184,166,0.1) inset',
            }}
          >
            <UserPlus className="w-5 h-5" />
            Register for Campaign Updates
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-4 flex flex-col sm:flex-row items-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 32px rgba(20,184,166,0.5)' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/inbox')}
            className="flex items-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 rounded-2xl text-base font-bold shadow-2xl shadow-teal-500/30 transition-colors"
          >
            Launch Agent Inbox <ArrowRight className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-2 px-8 py-4 border border-teal-500/40 hover:border-teal-400 hover:bg-teal-500/10 rounded-2xl text-base font-semibold transition-colors"
          >
            View Analytics
          </motion.button>
        </motion.div>

        {/* Telegram CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.75 }}
          className="mt-5"
        >
          <motion.a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl text-sm font-semibold transition-all"
            style={{
              background: 'linear-gradient(135deg, rgba(14,165,233,0.15) 0%, rgba(56,189,248,0.08) 100%)',
              border: '1.5px solid rgba(56,189,248,0.4)',
              color: '#7dd3fc',
              boxShadow: '0 0 0 1px rgba(56,189,248,0.08) inset',
            }}
          >
            <Send className="w-4 h-4" />
            Message us on Telegram
          </motion.a>
        </motion.div>

        {/* Channel pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          {channels.map((ch) =>
            ch.href ? (
              <a
                key={ch.label}
                href={ch.href}
                target={ch.href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-opacity hover:opacity-80 ${ch.color}`}
              >
                {ch.icon} {ch.label}
              </a>
            ) : (
              <span
                key={ch.label}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${ch.color}`}
              >
                {ch.icon} {ch.label}
              </span>
            )
          )}
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-white/20 text-white/50">
            + more channels
          </span>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold">
            Built for{' '}
            <span className="bg-gradient-to-r from-teal-300 to-emerald-300 bg-clip-text text-transparent">
              Modern Banking
            </span>
          </h2>
          <p className="mt-3 text-teal-100/60 text-lg max-w-xl mx-auto">
            Every feature designed for India's public sector banks, RRBs, and co-operative banks.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4, boxShadow: '0 20px 60px rgba(13,148,136,0.2)' }}
              className="p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm cursor-default"
            >
              <div className="w-11 h-11 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white text-base mb-2">{f.title}</h3>
              <p className="text-sm text-teal-100/60 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Pages quick nav */}
      <section className="relative z-10 px-6 py-12 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="p-8 rounded-3xl border border-teal-500/20 bg-teal-500/5 backdrop-blur-sm text-center"
        >
          <h3 className="text-xl font-bold mb-2">5 Powerful Modules</h3>
          <p className="text-teal-100/60 text-sm mb-6">Everything you need in one dashboard</p>
          <div className="flex flex-wrap justify-center gap-3">
            {pages.map((p, i) => (
              <motion.button
                key={p.path}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => navigate(p.path)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-teal-500/30 bg-teal-500/10 hover:bg-teal-500/20 text-sm font-medium text-teal-200 transition-colors"
              >
                {p.icon} {p.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 mt-8 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-teal-500/30 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-teal-400" />
            </div>
            <span className="font-semibold text-white text-sm">ContextFlow</span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-2 text-sm text-teal-300/70">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              Made by <span className="text-teal-300 font-semibold ml-1">Team CloudCompute</span>
            </span>
            <span className="hidden md:block text-teal-600">•</span>
            <a
              href="mailto:neobanksupport@gmail.com"
              className="text-teal-400 hover:text-teal-300 transition-colors font-medium"
            >
              neobanksupport@gmail.com
            </a>
            <span className="hidden md:block text-teal-600">•</span>
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors font-medium"
            >
              <Send className="w-3.5 h-3.5" />
              @ContextFlow_support_bot
            </a>
          </div>

          <div className="text-xs text-teal-600">idea 2.0 Hackathon 2026</div>
        </div>
      </footer>
    </div>
  )
}
