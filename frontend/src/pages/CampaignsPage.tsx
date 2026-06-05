import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Send, CheckCircle, AlertCircle, Megaphone, Trash2, ChevronRight, Loader2, Mail, Phone, MessageSquare, Monitor, Search, ShieldOff, Users, UserPlus, CalendarClock, X } from 'lucide-react'
import { campaignsApi } from '../services/api'
import type { Campaign } from '../types'
import { RegisterModalWrapper } from '../components/RegisterModal'

// ─── Status config ─────────────────────────────────────────────────────────

const STATUS = {
  draft:            { label: 'Draft',           color: 'bg-gray-100 text-gray-600 border-gray-200',     dot: 'bg-gray-400' },
  pending_approval: { label: 'Pending Approval', color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  approved:         { label: 'Approved',         color: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  running:          { label: 'Sending…',         color: 'bg-teal-50 text-teal-700 border-teal-200',      dot: 'bg-teal-500' },
  completed:        { label: 'Completed',        color: 'bg-green-50 text-green-700 border-green-200',   dot: 'bg-green-500' },
  cancelled:        { label: 'Cancelled',        color: 'bg-red-50 text-red-600 border-red-200',         dot: 'bg-red-400' },
  scheduled:        { label: 'Scheduled',        color: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
} as const

const CHANNEL_ICONS: Record<string, React.ReactElement> = {
  whatsapp:  <Phone className="w-3 h-3" />,
  instagram: <MessageSquare className="w-3 h-3" />,
  email:     <Mail className="w-3 h-3" />,
  telegram:  <Send className="w-3 h-3" />,
  simulator: <Monitor className="w-3 h-3" />,
}

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp:  'bg-green-100 text-green-700',
  instagram: 'bg-pink-100 text-pink-700',
  email:     'bg-blue-100 text-blue-700',
  telegram:  'bg-sky-100 text-sky-700',
  simulator: 'bg-gray-100 text-gray-600',
}

type Filter = 'all' | 'draft' | 'pending_approval' | 'approved' | 'scheduled' | 'running' | 'completed'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all',             label: 'All'       },
  { key: 'draft',           label: 'Draft'     },
  { key: 'pending_approval',label: 'Pending'   },
  { key: 'approved',        label: 'Approved'  },
  { key: 'scheduled',       label: 'Scheduled' },
  { key: 'running',         label: 'Live'      },
  { key: 'completed',       label: 'Done'      },
]

// ─── New Campaign form state ────────────────────────────────────────────────

const BLANK = { name: '', content_template: '', target_channels: ['whatsapp'] as string[] }

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns]     = useState<Campaign[]>([])
  const [selected, setSelected]       = useState<Campaign | null>(null)
  const [filter, setFilter]           = useState<Filter>('all')
  const [creating, setCreating]       = useState(false)
  const [form, setForm]               = useState(BLANK)
  const [busy, setBusy]               = useState(false)
  const [actionMsg, setActionMsg]     = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [panelWidth, setPanelWidth]   = useState(300)
  const dragging = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  const onDragStart = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    startX.current   = e.clientX
    startW.current   = panelWidth
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const next = Math.min(520, Math.max(220, startW.current + (e.clientX - startX.current)))
      setPanelWidth(next)
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  useEffect(() => {
    campaignsApi.list().then((data) => {
      setCampaigns(data)
      if (data.length > 0 && !selected && !creating) setSelected(data[0])
    })
  }, [])

  // Sync selected with latest list data (e.g. after status change)
  useEffect(() => {
    if (selected) {
      const fresh = campaigns.find((c) => c.id === selected.id)
      if (fresh) setSelected(fresh)
    }
  }, [campaigns])

  const flash = (msg: string) => {
    setActionMsg(msg)
    setTimeout(() => setActionMsg(null), 2500)
  }

  const updateOne = (updated: Partial<Campaign> & { id: string }) => {
    setCampaigns((prev) => prev.map((c) => c.id === updated.id ? { ...c, ...updated } : c))
    if (selected?.id === updated.id) setSelected((s) => s ? { ...s, ...updated } : s)
  }

  // ── Actions ──

  const handleCreate = async () => {
    if (!form.name.trim() || !form.content_template.trim()) return
    setBusy(true)
    try {
      const c = await campaignsApi.create({
        name: form.name,
        content_template: form.content_template,
        target_channels: form.target_channels,
      })
      setCampaigns((prev) => [c, ...prev])
      setSelected(c)
      setCreating(false)
      setForm(BLANK)
      flash('Campaign created')
    } finally { setBusy(false) }
  }

  const handleSubmit = async (id: string) => {
    setBusy(true)
    try {
      await campaignsApi.submitReview(id)
      updateOne({ id, status: 'pending_approval' })
      flash('Submitted for review')
    } finally { setBusy(false) }
  }

  const handleApprove = async (id: string, lockedEmails: string[]) => {
    setBusy(true)
    try {
      await campaignsApi.approve(id, lockedEmails)
      updateOne({ id, status: 'approved' })
      flash(`Campaign approved — ${lockedEmails.length} recipient${lockedEmails.length !== 1 ? 's' : ''} locked`)
    } finally { setBusy(false) }
  }

  const handleSchedule = async (id: string, scheduledAt: string) => {
    setBusy(true)
    try {
      await campaignsApi.schedule(id, scheduledAt)
      updateOne({ id, status: 'scheduled', scheduled_at: scheduledAt })
      const d = new Date(scheduledAt)
      const ist = d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      flash(`Campaign scheduled for ${ist} IST`)
    } finally { setBusy(false) }
  }

  const handleDispatch = async (id: string) => {
    setBusy(true)
    try {
      await campaignsApi.dispatch(id)
      updateOne({ id, status: 'running' })
      flash('Campaign dispatched — sending messages…')
      // Poll until completed
      const poll = setInterval(async () => {
        const data = await campaignsApi.list()
        setCampaigns(data)
        const c = data.find((x) => x.id === id)
        if (c && c.status !== 'running') {
          clearInterval(poll)
          setSelected(c)
        }
      }, 2000)
    } finally { setBusy(false) }
  }

  const handleCancel = async (id: string) => {
    setBusy(true)
    try {
      await campaignsApi.cancel(id)
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
      if (selected?.id === id) setSelected(null)
    } finally { setBusy(false) }
  }

  const filtered = campaigns.filter((c) => filter === 'all' || c.status === filter)

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      <RegisterModalWrapper show={showRegister} onClose={() => setShowRegister(false)} />

      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <Megaphone className="w-5 h-5 text-primary-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Campaigns</h1>
            <p className="text-xs text-gray-400">{campaigns.length} total · {campaigns.filter(c => c.status === 'running').length} live</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-1.5 px-4 py-2 border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Register to receive email
          </button>
          <button
            onClick={() => { setCreating(true); setSelected(null) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>

      {/* Flash message */}
      {actionMsg && (
        <div className="bg-teal-50 border-b border-teal-200 px-6 py-2 flex items-center gap-2 text-sm text-teal-700 flex-shrink-0">
          <CheckCircle className="w-4 h-4" /> {actionMsg}
        </div>
      )}

      {/* Body — two-panel */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left — list */}
        <div style={{ width: panelWidth }} className="flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

          {/* Filter tabs */}
          <div className="flex flex-wrap border-b border-gray-100 px-3 pt-3 pb-0 gap-0.5 flex-shrink-0">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors border-b-2 -mb-px ${
                  filter === key
                    ? 'border-primary-500 text-primary-700 bg-primary-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
                <span className="ml-1 text-[10px] text-gray-400">
                  {key === 'all' ? campaigns.length : campaigns.filter(c => c.status === key).length}
                </span>
              </button>
            ))}
          </div>

          {/* Campaign list */}
          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            {filtered.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                active={selected?.id === c.id && !creating}
                onClick={() => { setSelected(c); setCreating(false) }}
                onDelete={() => handleCancel(c.id)}
              />
            ))}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">No campaigns</div>
            )}
          </div>
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="w-1 flex-shrink-0 bg-gray-200 hover:bg-primary-400 active:bg-primary-500 cursor-col-resize transition-colors"
          title="Drag to resize"
        />

        {/* Right — detail / create */}
        <div className="flex-1 overflow-y-auto">
          {creating ? (
            <NewCampaignForm
              form={form}
              setForm={setForm}
              busy={busy}
              onCreate={handleCreate}
              onCancel={() => { setCreating(false); if (campaigns.length > 0) setSelected(campaigns[0]) }}
            />
          ) : selected ? (
            <CampaignDetail
              campaign={selected}
              busy={busy}
              onSubmit={handleSubmit}
              onApprove={handleApprove}
              onDispatch={handleDispatch}
              onSchedule={handleSchedule}
              onCancel={handleCancel}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Select a campaign or create one</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ─── Campaign Card (left list item) ─────────────────────────────────────────

function CampaignCard({ campaign: c, active, onClick, onDelete }: {
  campaign: Campaign; active: boolean; onClick: () => void; onDelete: () => void
}) {
  const st = STATUS[c.status as keyof typeof STATUS] ?? STATUS.draft
  const canDelete = c.status !== 'running'

  return (
    <div
      className={`relative group rounded-xl transition-colors border ${
        active
          ? 'bg-primary-50 border-primary-200'
          : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-200'
      }`}
    >
      <button onClick={onClick} className="w-full text-left px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.content_template}</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium border ${st.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </span>
          {c.status === 'running' && <Loader2 className="w-3 h-3 text-teal-500 animate-spin" />}
        </div>
      </button>

      {/* Delete button — appears on hover */}
      {canDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
          title="Delete campaign"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Campaign Detail Panel ───────────────────────────────────────────────────

type Recipient = { email: string; name: string; channels: string[]; is_dnc: boolean }

function RecipientPicker({ campaignId, busy, onApprove }: {
  campaignId: string
  busy: boolean
  onApprove: (lockedEmails: string[]) => void
}) {
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    campaignsApi.recipients(campaignId).then((data) => {
      setRecipients(data)
      // Pre-select all non-DNC contacts
      setSelected(new Set(data.filter((r) => !r.is_dnc).map((r) => r.email)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [campaignId])

  const filtered = recipients.filter((r) => {
    const q = search.toLowerCase()
    return !q || r.email.includes(q) || r.name.toLowerCase().includes(q)
  })

  const nonDncFiltered = filtered.filter((r) => !r.is_dnc)
  const allSelected = nonDncFiltered.length > 0 && nonDncFiltered.every((r) => selected.has(r.email))

  const toggleAll = () => {
    if (allSelected) {
      setSelected((s) => { const n = new Set(s); nonDncFiltered.forEach((r) => n.delete(r.email)); return n })
    } else {
      setSelected((s) => { const n = new Set(s); nonDncFiltered.forEach((r) => n.add(r.email)); return n })
    }
  }

  const toggle = (email: string) => {
    setSelected((s) => { const n = new Set(s); n.has(email) ? n.delete(email) : n.add(email); return n })
  }

  const selectedCount = recipients.filter((r) => selected.has(r.email)).length
  const dncCount      = recipients.filter((r) => r.is_dnc).length

  if (loading) return (
    <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading contacts…
    </div>
  )

  if (recipients.length === 0) return (
    <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
      <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
      No contacts in the whitelist yet.
      <br />Share the landing page registration link to collect recipients.
    </div>
  )

  return (
    <div className="mt-1">
      {/* Search + select-all row */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email or name…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <button
          onClick={toggleAll}
          className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 whitespace-nowrap"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {/* Count bar */}
      <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-2">
        <span className="text-primary-600 font-medium">{selectedCount} selected</span>
        <span>·</span>
        <span>{recipients.length} total</span>
        {dncCount > 0 && <><span>·</span><span className="text-red-500">{dncCount} excluded (DNC)</span></>}
      </div>

      {/* List */}
      <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-64 overflow-y-auto">
        {filtered.map((r) => (
          <label
            key={r.email}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
              r.is_dnc ? 'bg-red-50/50 cursor-not-allowed' : 'hover:bg-gray-50'
            }`}
          >
            <input
              type="checkbox"
              disabled={r.is_dnc}
              checked={selected.has(r.email)}
              onChange={() => !r.is_dnc && toggle(r.email)}
              className="rounded text-primary-600 focus:ring-primary-500 disabled:opacity-40"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-xs font-mono font-medium truncate ${r.is_dnc ? 'text-gray-400' : 'text-gray-800'}`}>
                  {r.email}
                </span>
                {r.name && <span className="text-[10px] text-gray-400">({r.name})</span>}
                {r.is_dnc && (
                  <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">
                    <ShieldOff className="w-2.5 h-2.5" /> DNC
                  </span>
                )}
              </div>
              <div className="flex gap-1 mt-0.5">
                {r.channels.map((ch) => (
                  <span key={ch} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${CHANNEL_COLORS[ch] ?? 'bg-gray-100 text-gray-500'}`}>
                    {ch}
                  </span>
                ))}
              </div>
            </div>
          </label>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-6 text-xs text-gray-400">No matches</div>
        )}
      </div>

      <button
        onClick={() => onApprove([...selected])}
        disabled={busy || selectedCount === 0}
        className="mt-4 flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
        Approve & lock {selectedCount} recipient{selectedCount !== 1 ? 's' : ''}
      </button>
    </div>
  )
}

function CampaignDetail({ campaign: c, busy, onSubmit, onApprove, onDispatch, onSchedule, onCancel: _onCancel }: {
  campaign: Campaign
  busy: boolean
  onSubmit: (id: string) => void
  onApprove: (id: string, lockedEmails: string[]) => void
  onDispatch: (id: string) => void
  onSchedule: (id: string, scheduledAt: string) => void
  onCancel: (id: string) => void
}) {
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduleInput, setScheduleInput] = useState('')

  const st = STATUS[c.status as keyof typeof STATUS] ?? STATUS.draft

  // Build default value for datetime-local: now + 1 hour in LOCAL time (IST on user's machine)
  const defaultScheduleValue = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const handleOpenScheduler = () => {
    setScheduleInput(defaultScheduleValue())
    setShowScheduler(true)
  }

  const handleConfirmSchedule = () => {
    if (!scheduleInput) return
    // datetime-local gives local time — convert to ISO with offset for backend
    const localDate = new Date(scheduleInput)
    onSchedule(c.id, localDate.toISOString())
    setShowScheduler(false)
  }

  // Format scheduled_at in IST for display
  const scheduledAtIST = c.scheduled_at
    ? new Date(c.scheduled_at).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  const deliveryRate = c.sent_count > 0
    ? Math.round((c.delivered_count / c.sent_count) * 100)
    : 0

  return (
    <div className="max-w-2xl mx-auto p-8">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{c.name}</h2>
          <p className="text-xs text-gray-400 mt-1">
            Created {new Date(c.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border ${st.color}`}>
          {c.status === 'running' ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className={`w-2 h-2 rounded-full ${st.dot}`} />}
          {st.label}
        </span>
      </div>

      {/* Target channels */}
      <Section title="Target Channels">
        <div className="flex flex-wrap gap-2">
          {c.target_channels.map((ch) => (
            <span key={ch} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${CHANNEL_COLORS[ch] ?? 'bg-gray-100 text-gray-600'}`}>
              {CHANNEL_ICONS[ch]}
              {ch.charAt(0).toUpperCase() + ch.slice(1)}
            </span>
          ))}
        </div>
      </Section>

      {/* Message template */}
      <Section title="Message Template">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {c.content_template}
          </pre>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Use <code className="bg-gray-100 px-1 rounded text-xs">{"{{name}}"}</code> for the customer's first name
        </p>
      </Section>

      {/* Stats — shown for completed / running */}
      {(c.status === 'completed' || c.status === 'running' || c.sent_count > 0) && (
        <Section title="Delivery Stats">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Sent" value={c.sent_count} icon={<Send className="w-4 h-4 text-blue-500" />} color="bg-blue-50" />
            <StatCard label="Delivered" value={c.delivered_count} icon={<CheckCircle className="w-4 h-4 text-green-500" />} color="bg-green-50" />
            <StatCard label="Delivery Rate" value={`${deliveryRate}%`} icon={<AlertCircle className="w-4 h-4 text-teal-500" />} color="bg-teal-50" />
          </div>
        </Section>
      )}

      {/* Recipient picker — only shown during approval */}
      {c.status === 'pending_approval' && (
        <Section title="Recipients — Select who receives this campaign">
          <RecipientPicker
            campaignId={c.id}
            busy={busy}
            onApprove={(lockedEmails) => onApprove(c.id, lockedEmails)}
          />
        </Section>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-3 mt-8">
        {c.status === 'draft' && (
          <ActionButton
            label="Submit for Review"
            icon={<ChevronRight className="w-4 h-4" />}
            color="bg-amber-500 hover:bg-amber-600 text-white"
            disabled={busy}
            onClick={() => onSubmit(c.id)}
          />
        )}

        {c.status === 'approved' && (
          <>
            <ActionButton
              label="Dispatch Now"
              icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              color="bg-primary-600 hover:bg-primary-700 text-white"
              disabled={busy}
              onClick={() => onDispatch(c.id)}
            />
            <ActionButton
              label="Schedule for Later"
              icon={<CalendarClock className="w-4 h-4" />}
              color="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={busy}
              onClick={handleOpenScheduler}
            />
          </>
        )}

        {/* Inline scheduler form */}
        {showScheduler && c.status === 'approved' && (
          <div className="w-full mt-2 p-4 bg-purple-50 border border-purple-200 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-purple-800 flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4" /> Schedule dispatch
              </p>
              <button onClick={() => setShowScheduler(false)} className="text-purple-400 hover:text-purple-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-purple-600 mb-3">
              The campaign will send automatically at this time. Missed schedules fire immediately on backend restart.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="datetime-local"
                value={scheduleInput}
                onChange={(e) => setScheduleInput(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="border border-purple-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              />
              <button
                onClick={handleConfirmSchedule}
                disabled={!scheduleInput || busy}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                Confirm Schedule
              </button>
            </div>
          </div>
        )}

        {c.status === 'scheduled' && (
          <div className="flex flex-wrap items-center gap-3 w-full">
            <div className="flex items-center gap-2 text-sm text-purple-700 bg-purple-50 px-4 py-2 rounded-lg border border-purple-200">
              <CalendarClock className="w-4 h-4" />
              Scheduled for <strong>{scheduledAtIST} IST</strong>
            </div>
            <ActionButton
              label="Dispatch Now (early)"
              icon={busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              color="bg-primary-600 hover:bg-primary-700 text-white"
              disabled={busy}
              onClick={() => onDispatch(c.id)}
            />
          </div>
        )}

        {c.status === 'running' && (
          <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 px-4 py-2 rounded-lg border border-teal-200">
            <Loader2 className="w-4 h-4 animate-spin" />
            Sending messages to customers…
          </div>
        )}

        {c.status === 'completed' && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
            <CheckCircle className="w-4 h-4" />
            Campaign completed successfully
          </div>
        )}

      </div>

      {/* Lifecycle guide */}
      <div className="mt-8 border-t border-gray-100 pt-6">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Campaign Lifecycle</p>
        <div className="flex items-center gap-1 text-xs text-gray-400 flex-wrap">
          {['Draft', 'Pending Approval', 'Approved', 'Scheduled', 'Sending', 'Completed'].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded ${
                (c.status === 'draft' && step === 'Draft') ||
                (c.status === 'pending_approval' && step === 'Pending Approval') ||
                (c.status === 'approved' && step === 'Approved') ||
                (c.status === 'scheduled' && step === 'Scheduled') ||
                (c.status === 'running' && step === 'Sending') ||
                (c.status === 'completed' && step === 'Completed')
                  ? 'bg-primary-100 text-primary-700 font-medium'
                  : 'text-gray-400'
              }`}>{step}</span>
              {i < arr.length - 1 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── New Campaign Form (right panel) ────────────────────────────────────────

function NewCampaignForm({ form, setForm, busy, onCreate, onCancel }: {
  form: typeof BLANK
  setForm: React.Dispatch<React.SetStateAction<typeof BLANK>>
  busy: boolean
  onCreate: () => void
  onCancel: () => void
}) {
  const ALL_CHANNELS = ['whatsapp', 'email', 'telegram', 'instagram']

  const toggleChannel = (ch: string) => {
    setForm((f) => ({
      ...f,
      target_channels: f.target_channels.includes(ch)
        ? f.target_channels.filter((c) => c !== ch)
        : [...f.target_channels, ch],
    }))
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">New Campaign</h2>

      <div className="space-y-5">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Monsoon Savings Drive"
            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Target channels</label>
          <div className="flex flex-wrap gap-2">
            {ALL_CHANNELS.map((ch) => {
              const active = form.target_channels.includes(ch)
              return (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? `${CHANNEL_COLORS[ch]} border-current`
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {CHANNEL_ICONS[ch]}
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </button>
              )
            })}
          </div>
          {form.target_channels.length === 0 && (
            <p className="text-xs text-red-500 mt-1">Select at least one channel</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Message template</label>
          <textarea
            value={form.content_template}
            onChange={(e) => setForm({ ...form, content_template: e.target.value })}
            placeholder={`Hello {{name}},\n\nWe have an exclusive offer just for you…\n\n— NeoBank Team`}
            rows={6}
            className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            Use <code className="bg-gray-100 px-1 rounded">{"{{name}}"}</code> to personalise with the customer's first name
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCreate}
            disabled={busy || !form.name.trim() || !form.content_template.trim() || form.target_channels.length === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Campaign
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>

      </div>

      {/* Info box */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-medium">How campaigns work</p>
        <p>1. Create a draft and write your message template.</p>
        <p>2. Submit for review — a manager approves it.</p>
        <p>3. Once approved, dispatch sends to all eligible customers across the target channels.</p>
        <p>4. Customers on the Do Not Contact list are automatically skipped.</p>
      </div>
    </div>
  )
}

// ─── Small helpers ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}

function StatCard({ label, value, icon, color }: {
  label: string; value: number | string; icon: React.ReactNode; color: string
}) {
  return (
    <div className={`${color} rounded-xl p-3 flex items-center gap-3`}>
      {icon}
      <div>
        <p className="text-lg font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function ActionButton({ label, icon, color, disabled, onClick }: {
  label: string; icon: React.ReactNode; color: string; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${color}`}
    >
      {icon} {label}
    </button>
  )
}
