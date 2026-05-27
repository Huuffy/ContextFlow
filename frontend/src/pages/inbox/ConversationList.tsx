import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MessageSquare, Mail, Phone, Send, Clock, Inbox, History, SlidersHorizontal, X } from 'lucide-react'
import { useConversationStore } from '../../stores/conversationStore'
import type { Conversation } from '../../types'

const channelConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  whatsapp:  { color: 'text-green-700', bg: 'bg-green-100',  icon: <Phone className="w-3 h-3" />,        label: 'WhatsApp'  },
  instagram: { color: 'text-pink-700',  bg: 'bg-pink-100',   icon: <MessageSquare className="w-3 h-3" />, label: 'Instagram' },
  email:     { color: 'text-blue-700',  bg: 'bg-blue-100',   icon: <Mail className="w-3 h-3" />,          label: 'Email'     },
  telegram:  { color: 'text-sky-700',   bg: 'bg-sky-100',    icon: <Send className="w-3 h-3" />,          label: 'Telegram'  },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  open:             { label: 'Open',               color: 'bg-teal-50 text-teal-700 border border-teal-200'     },
  waiting:          { label: 'Awaiting Reply',      color: 'bg-amber-50 text-amber-700 border border-amber-200'  },
  awaiting_acc_no:  { label: 'Awaiting Account No', color: 'bg-purple-50 text-purple-700 border border-purple-200' },
  resolved:         { label: 'Resolved',            color: 'bg-gray-100 text-gray-500 border border-gray-200'    },
  closed:           { label: 'Closed',              color: 'bg-gray-200 text-gray-500 border border-gray-300'    },
}

const sentimentConfig: Record<string, { color: string; label: string }> = {
  positive:  { color: 'bg-green-100 text-green-700',   label: 'Positive'   },
  neutral:   { color: 'bg-gray-100 text-gray-600',     label: 'Neutral'    },
  negative:  { color: 'bg-red-100 text-red-700',       label: 'Negative'   },
  frustrated:{ color: 'bg-orange-100 text-orange-700', label: 'Frustrated' },
}

// Filter options per tab
const filterOptions: Record<'active' | 'history', { key: string; label: string; activeClass: string }[]> = {
  active: [
    { key: 'open',            label: 'Open',               activeClass: 'bg-teal-500 text-white border-teal-500'     },
    { key: 'waiting',         label: 'Awaiting Reply',      activeClass: 'bg-amber-500 text-white border-amber-500'   },
    { key: 'awaiting_acc_no', label: 'Awaiting Acc No',     activeClass: 'bg-purple-500 text-white border-purple-500' },
  ],
  history: [
    { key: 'resolved', label: 'Resolved', activeClass: 'bg-gray-500 text-white border-gray-500' },
    { key: 'closed',   label: 'Closed',   activeClass: 'bg-gray-700 text-white border-gray-700' },
  ],
}

function timeAgo(dateStr?: string) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}

const avatarColors = [
  'bg-teal-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500',
]

function avatarColor(name?: string) {
  if (!name) return avatarColors[0]
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

interface Props {
  conversations: Conversation[]
  onSelect: (id: string) => void
  tab: 'active' | 'history'
  setTab: (t: 'active' | 'history') => void
  search: string
  setSearch: (s: string) => void
  activeCount: number
  historyCount: number
  statusFilter: string[]
  setStatusFilter: (f: string[]) => void
}

export default function ConversationList({
  conversations, onSelect, tab, setTab, search, setSearch,
  activeCount, historyCount, statusFilter, setStatusFilter,
}: Props) {
  const activeId = useConversationStore((s) => s.activeId)
  const [showFilter, setShowFilter] = useState(false)

  const toggleStatus = (key: string) => {
    setStatusFilter(
      statusFilter.includes(key)
        ? statusFilter.filter((s) => s !== key)
        : [...statusFilter, key]
    )
  }

  const opts = filterOptions[tab]
  const hasFilter = statusFilter.length > 0

  return (
    <div className="h-full flex flex-col bg-gray-50 border-r border-gray-200 overflow-hidden min-h-0">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-100 flex-shrink-0">
        <h2 className="text-base font-bold text-gray-900 mb-3">Inbox</h2>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
          <button
            onClick={() => setTab('active')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              tab === 'active'
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            Active
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              tab === 'active' ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'
            }`}>{activeCount}</span>
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
              tab === 'history'
                ? 'bg-white text-gray-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              tab === 'history' ? 'bg-gray-200 text-gray-600' : 'bg-gray-200 text-gray-500'
            }`}>{historyCount}</span>
          </button>
        </div>

        {/* Search + filter button row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 focus:bg-white transition-colors placeholder:text-gray-400"
            />
          </div>
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`relative flex-shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              showFilter || hasFilter
                ? 'bg-teal-50 text-teal-700 border-teal-300'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
            title="Filter by status"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {hasFilter && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-teal-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                {statusFilter.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter chips panel */}
        <AnimatePresence>
          {showFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="pt-2.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Filter by status</span>
                  {hasFilter && (
                    <button
                      onClick={() => setStatusFilter([])}
                      className="flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {opts.map((opt) => {
                    const active = statusFilter.includes(opt.key)
                    return (
                      <button
                        key={opt.key}
                        onClick={() => toggleStatus(opt.key)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                          active
                            ? opt.activeClass
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1.5">
        <AnimatePresence>
          {conversations.map((conv, idx) => {
            const isSelected = activeId === conv.id
            const sentiment = sentimentConfig[conv.sentiment ?? 'neutral']
            const channels = conv.active_channels ?? []

            return (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: idx * 0.025, duration: 0.2 }}
                onClick={() => onSelect(conv.id)}
                className={`w-full text-left rounded-xl border p-3 transition-all duration-150 ${
                  isSelected
                    ? 'bg-teal-50 border-teal-300 shadow-sm ring-1 ring-teal-200'
                    : 'bg-white border-gray-100 hover:border-teal-200 hover:shadow-sm hover:bg-teal-50/30'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full ${avatarColor(conv.customer_name)} flex items-center justify-center flex-shrink-0 text-white text-xs font-bold shadow-sm`}>
                    {initials(conv.customer_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Top row: name + time */}
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-sm font-semibold text-gray-900 truncate leading-tight">
                        {conv.customer_name ?? 'Customer'}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3 text-gray-300" />
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo(conv.last_message_at)}</span>
                      </div>
                    </div>

                    {/* Topic */}
                    {conv.topic && (
                      <p className="text-[11px] text-gray-500 font-medium truncate mb-1">{conv.topic}</p>
                    )}

                    {/* One-liner */}
                    {conv.one_liner ? (
                      <p className="text-xs text-gray-600 truncate italic leading-relaxed mb-2">
                        "{conv.one_liner}"
                      </p>
                    ) : (
                      <p className="text-xs text-gray-300 italic mb-2">Generating summary…</p>
                    )}

                    {/* Bottom row: channels + status + sentiment */}
                    <div className="flex items-center justify-between gap-1 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        {channels.map((ch) => {
                          const cfg = channelConfig[ch]
                          if (!cfg) return null
                          return (
                            <span key={ch} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          )
                        })}
                        {(() => {
                          const sc = statusConfig[conv.status]
                          return sc ? (
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sc.color}`}>
                              {sc.label}
                            </span>
                          ) : null
                        })()}
                      </div>
                      {conv.sentiment && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${sentiment.color} flex-shrink-0`}>
                          {sentiment.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </AnimatePresence>

        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              {tab === 'active' ? <Inbox className="w-5 h-5 text-gray-300" /> : <History className="w-5 h-5 text-gray-300" />}
            </div>
            <p className="text-sm text-gray-400 font-medium">
              {search ? 'No matches found' : hasFilter ? 'No conversations match this filter' : tab === 'active' ? 'No active conversations' : 'No history yet'}
            </p>
            {(search || hasFilter) && (
              <button
                onClick={() => { setSearch(''); setStatusFilter([]) }}
                className="mt-2 text-xs text-teal-600 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
