import { useEffect, useState, useRef } from 'react'
import { Mail, X, CreditCard, Landmark, Wallet, Banknote, ArrowUpRight, ArrowDownLeft, ExternalLink, Copy, Check } from 'lucide-react'
import { useConversationStore } from '../../stores/conversationStore'
import { conversations as convApi } from '../../services/api'
import type { Conversation } from '../../types'
import ConversationList from './ConversationList'
import ConversationThread from './ConversationThread'
import Customer360Panel from './Customer360Panel'

const DEMO_ACCOUNTS = [
  {
    number: '8888',
    label: 'Savings Account',
    balance: '₹1,24,500',
    icon: Landmark,
    color: 'teal',
    transactions: [
      { date: 'May 26', desc: 'Amazon Shopping', amount: '₹3,200', type: 'debit' },
      { date: 'May 24', desc: 'Salary Credit', amount: '₹55,000', type: 'credit' },
      { date: 'May 22', desc: 'Electricity Bill', amount: '₹1,850', type: 'debit' },
      { date: 'May 19', desc: 'Zomato Order', amount: '₹450', type: 'debit' },
      { date: 'May 15', desc: 'ATM Withdrawal', amount: '₹5,000', type: 'debit' },
    ],
  },
  {
    number: '9999',
    label: 'Current Account',
    balance: '₹3,80,200',
    icon: Wallet,
    color: 'blue',
    transactions: [
      { date: 'May 27', desc: 'NEFT Transfer In', amount: '₹1,20,000', type: 'credit' },
      { date: 'May 25', desc: 'Vendor Payment', amount: '₹45,000', type: 'debit' },
      { date: 'May 23', desc: 'GST Payment', amount: '₹18,200', type: 'debit' },
      { date: 'May 20', desc: 'Client Receipt', amount: '₹2,00,000', type: 'credit' },
      { date: 'May 18', desc: 'Office Supplies', amount: '₹3,600', type: 'debit' },
    ],
  },
  {
    number: '7777',
    label: 'Credit Account',
    balance: '₹42,750 due',
    icon: CreditCard,
    color: 'purple',
    transactions: [
      { date: 'May 25', desc: 'Swiggy Order', amount: '₹680', type: 'debit' },
      { date: 'May 22', desc: 'UNKNOWN_MERCH_INT', amount: '₹2,500', type: 'debit' },
      { date: 'May 20', desc: 'Myntra Purchase', amount: '₹4,299', type: 'debit' },
      { date: 'May 17', desc: 'Payment Received', amount: '₹15,000', type: 'credit' },
      { date: 'May 14', desc: 'BookMyShow', amount: '₹820', type: 'debit' },
    ],
  },
  {
    number: '6666',
    label: 'Salary Account',
    balance: '₹68,300',
    icon: Banknote,
    color: 'amber',
    transactions: [
      { date: 'May 26', desc: 'Grocery Store UPI', amount: '₹5,000', type: 'debit' },
      { date: 'May 24', desc: 'Salary Credit', amount: '₹72,000', type: 'credit' },
      { date: 'May 22', desc: 'Flipkart Order', amount: '₹5,500', type: 'debit' },
      { date: 'May 19', desc: 'Netflix Subscription', amount: '₹649', type: 'debit' },
      { date: 'May 15', desc: 'UPI Transfer Out', amount: '₹2,000', type: 'debit' },
    ],
  },
]

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; light: string }> = {
  teal:   { bg: 'bg-teal-500',   text: 'text-teal-700',   border: 'border-teal-200',   light: 'bg-teal-50'   },
  blue:   { bg: 'bg-blue-500',   text: 'text-blue-700',   border: 'border-blue-200',   light: 'bg-blue-50'   },
  purple: { bg: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-200', light: 'bg-purple-50' },
  amber:  { bg: 'bg-amber-500',  text: 'text-amber-700',  border: 'border-amber-200',  light: 'bg-amber-50'  },
}

const GMAIL_URL = 'https://mail.google.com/mail/u/0/#inbox?compose=new'
const INBOX_EMAIL = 'virajbhatia1611@gmail.com'

function CopyEmailButton({ email }: { email: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-teal-200 hover:bg-teal-50 transition-colors"
    >
      <span className="text-xs font-mono font-semibold text-teal-800">{email}</span>
      {copied
        ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
        : <Copy className="w-3 h-3 text-teal-500 flex-shrink-0" />
      }
    </button>
  )
}
const COUNTDOWN_SEC = 10

function TestEmailModal({ onClose }: { onClose: () => void }) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SEC)
  const ready = seconds <= 0

  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [seconds, ready])

  const handleOpenGmail = () => {
    window.open(GMAIL_URL, '_blank', 'noopener,noreferrer')
  }

  const circumference = 2 * Math.PI * 18
  const progress = (seconds / COUNTDOWN_SEC) * circumference

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', backgroundColor: 'rgba(0,0,0,0.35)' }}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: '82vh' }}>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Demo Account Reference</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                For payment-related issues, NeoBank links your account transactions directly to the support thread
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Send-to address */}
          <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200">
            <Mail className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
            <span className="text-xs text-teal-700 flex-1">Send your email <strong>to:</strong></span>
            <CopyEmailButton email={INBOX_EMAIL} />
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {DEMO_ACCOUNTS.map((acc) => {
            const c = COLOR_MAP[acc.color]
            const Icon = acc.icon
            return (
              <div key={acc.number} className={`rounded-xl border ${c.border} ${c.light} p-3`}>
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${c.text}`}>#{acc.number}</span>
                      <span className="text-xs text-gray-600">{acc.label}</span>
                    </div>
                    <div className="text-xs text-gray-500">Balance: <span className="font-medium text-gray-700">{acc.balance}</span></div>
                  </div>
                </div>
                <div className="space-y-1">
                  {acc.transactions.map((tx, i) => (
                    <div key={i} className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {tx.type === 'credit'
                          ? <ArrowDownLeft className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                          : <ArrowUpRight className="w-3 h-3 text-red-400 flex-shrink-0" />
                        }
                        <span className="text-gray-700 truncate">{tx.desc}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className={tx.type === 'credit' ? 'text-emerald-600 font-medium' : 'text-gray-700'}>{tx.amount}</span>
                        <span className="text-gray-400">{tx.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-gray-50 rounded-b-2xl overflow-hidden">
          {/* Ready state — big CTA */}
          {ready ? (
            <div className="px-5 py-4 flex items-center gap-4">
              <button
                onClick={handleOpenGmail}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white transition-all shadow-md shadow-teal-200 animate-pulse"
              >
                <Mail className="w-4 h-4" />
                Open Gmail — send test email
              </button>
              <button onClick={onClose} className="px-4 py-3 rounded-xl text-xs font-medium bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors">
                Close
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex items-center gap-3">
                {/* Circular countdown */}
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle
                      cx="20" cy="20" r="18"
                      fill="none"
                      stroke={seconds <= 3 ? '#f87171' : '#14b8a6'}
                      strokeWidth="3"
                      strokeDasharray={`${circumference}`}
                      strokeDashoffset={`${circumference - progress}`}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
                    />
                  </svg>
                  <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${seconds <= 3 ? 'text-red-500' : 'text-teal-600'}`}>
                    {seconds}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-700">Read the account reference above</p>
                  <p className="text-xs text-gray-400">Gmail button appears in {seconds}s</p>
                </div>
              </div>
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-xs font-medium bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InboxPage() {
  const { conversations, activeId, setConversations, setActive } = useConversationStore()
  const [history, setHistory] = useState<Conversation[]>([])
  const [tab, setTab] = useState<'active' | 'history'>('active')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [panelWidth, setPanelWidth] = useState(300)
  const [showTestModal, setShowTestModal] = useState(false)

  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const active = conversations.find((c) => c.id === activeId) ?? history.find((c) => c.id === activeId) ?? null

  useEffect(() => {
    const loadActive = () =>
      Promise.all([convApi.list({ status: 'open' }), convApi.list({ status: 'waiting' }), convApi.list({ status: 'awaiting_acc_no' })]).then(
        ([open, waiting, awaitingAcc]) =>
          setConversations(
            [...open, ...waiting, ...awaitingAcc].sort(
              (a, b) =>
                new Date(b.last_message_at ?? b.created_at).getTime() -
                new Date(a.last_message_at ?? a.created_at).getTime()
            )
          )
      )

    loadActive()
    Promise.all([convApi.list({ status: 'resolved' }), convApi.list({ status: 'closed' })]).then(
      ([resolved, closed]) =>
        setHistory(
          [...resolved, ...closed].sort(
            (a, b) =>
              new Date(b.last_message_at ?? b.created_at).getTime() -
              new Date(a.last_message_at ?? a.created_at).getTime()
          )
        )
    )

    const interval = setInterval(loadActive, 15000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      setPanelWidth(Math.min(520, Math.max(220, startW.current + (e.clientX - startX.current))))
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const onDragStart = (e: React.MouseEvent) => {
    dragging.current = true
    startX.current = e.clientX
    startW.current = panelWidth
    e.preventDefault()
  }

  const displayList = tab === 'active' ? conversations : history

  const handleTabChange = (t: 'active' | 'history') => {
    setTab(t)
    setStatusFilter([])
  }

  const filtered = displayList.filter((c) => {
    const matchSearch = !search || (() => {
      const q = search.toLowerCase()
      return (
        c.customer_name?.toLowerCase().includes(q) ||
        c.topic?.toLowerCase().includes(q) ||
        c.one_liner?.toLowerCase().includes(q)
      )
    })()
    return matchSearch && (statusFilter.length === 0 || statusFilter.includes(c.status))
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">

      {showTestModal && <TestEmailModal onClose={() => setShowTestModal(false)} />}

      {/* Live test banner */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-teal-50 border-b border-teal-100 text-xs">
        <div className="flex items-center gap-2 text-teal-700">
          <Mail className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Live test — send an email to <strong>{INBOX_EMAIL}</strong> to see it appear here as a new ticket</span>
        </div>
        <button
          onClick={() => setShowTestModal(true)}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-medium transition-colors whitespace-nowrap"
        >
          <Mail className="w-3 h-3" />
          Send test email
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left panel — resizable */}
        <div style={{ width: panelWidth, flexShrink: 0 }} className="overflow-hidden flex flex-col min-h-0">
          <ConversationList
            conversations={filtered}
            onSelect={setActive}
            tab={tab}
            setTab={handleTabChange}
            search={search}
            setSearch={setSearch}
            activeCount={conversations.length}
            historyCount={history.length}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="w-1 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-teal-400 active:bg-teal-500 transition-colors"
        />

        {/* Center — conversation thread */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ConversationThread
            conversation={active}
            onClose={(id) => {
              setConversations(conversations.filter((c) => c.id !== id))
              setActive('')
            }}
          />
        </div>

        {/* Right panel — customer 360, fixed width */}
        <div style={{ width: 360, flexShrink: 0 }} className="overflow-hidden min-h-0">
          <Customer360Panel conversation={active} />
        </div>

      </div>
    </div>
  )
}
