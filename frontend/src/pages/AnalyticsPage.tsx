import { useState, useEffect } from 'react'
import { analytics } from '../services/api'
import axios from 'axios'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { MessageSquare, CheckCircle, Clock, AlertTriangle, TrendingUp, Inbox, Ban, Users, UserX, FlaskConical } from 'lucide-react'

const CHANNEL_COLORS: Record<string, string> = {
  whatsapp: '#22c55e',
  instagram: '#ec4899',
  email: '#3b82f6',
  telegram: '#0ea5e9',
}

const SENTIMENT_COLORS: Record<string, string> = {
  positive: '#10b981',
  neutral: '#6b7280',
  negative: '#ef4444',
  frustrated: '#f97316',
}

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
  frustrated: 'Frustrated',
}

interface DashData {
  total_conversations: number
  active_conversations: number
  open_conversations: number
  waiting_conversations: number
  awaiting_acc_no: number
  resolved_conversations: number
  closed_conversations: number
  resolved_today: number
  resolved_this_week: number
  total_messages: number
  dnc_count: number
  sla_breached: number
  resolution_rate: number
  avg_response_minutes: number
  channel_breakdown: { channel: string; count: number }[]
  volume_by_month: { month: string; count: number }[]
  sentiment_distribution: { sentiment: string; count: number }[]
  status_breakdown: { status: string; count: number; color: string }[]
  top_issues: { issue: string; count: number }[]
}

function KpiCard({
  label, value, sub, icon, color = 'teal',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color?: 'teal' | 'amber' | 'red' | 'blue' | 'green' | 'purple' | 'gray'
}) {
  const colorMap = {
    teal:   { bg: 'bg-teal-50',   text: 'text-teal-600',   iconBg: 'bg-teal-100'   },
    amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  iconBg: 'bg-amber-100'  },
    red:    { bg: 'bg-red-50',    text: 'text-red-600',    iconBg: 'bg-red-100'    },
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   iconBg: 'bg-blue-100'   },
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  iconBg: 'bg-green-100'  },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-100' },
    gray:   { bg: 'bg-gray-50',   text: 'text-gray-600',   iconBg: 'bg-gray-100'   },
  }
  const c = colorMap[color]
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
        <div className={c.text}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${c.text}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs">
        <p className="font-medium text-gray-700">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} style={{ color: p.fill || p.stroke }}>{p.value} {p.name}</p>
        ))}
      </div>
    )
  }
  return null
}

interface AgentRow { id: string; name: string; email: string; role: string; active_tickets: number }
interface UnassignedRow { id: string; topic: string; status: string; customer_name: string; created_at: string }
interface WorkloadData { agents: AgentRow[]; unassigned: UnassignedRow[] }

export default function AnalyticsPage() {
  const [data, setData] = useState<DashData | null>(null)
  const [workload, setWorkload] = useState<WorkloadData | null>(null)

  useEffect(() => {
    analytics.dashboard().then(setData)
    const base = import.meta.env.VITE_API_URL ?? '/api/v1'
    const token = localStorage.getItem('token')
    axios.get(`${base}/analytics/agent-workload`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(r => setWorkload(r.data)).catch(() => {})
  }, [])

  if (!data) return <div className="h-full flex items-center justify-center text-gray-400 text-sm">Loading…</div>

  const totalSentiment = data.sentiment_distribution.reduce((s, x) => s + x.count, 0)

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-y-auto">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <h1 className="text-lg font-semibold text-gray-900">Analytics</h1>
        <p className="text-xs text-gray-500 mt-0.5">Support operations overview — NeoBank</p>
      </div>

      <div className="p-6 space-y-6">

        {/* KPI row 1 — ticket health */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ticket Health</p>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Total Conversations" value={data.total_conversations} icon={<MessageSquare className="w-4 h-4" />} color="teal" />
            <KpiCard label="Active Tickets" value={data.active_conversations} sub={`${data.open_conversations} open · ${data.waiting_conversations} awaiting reply`} icon={<Inbox className="w-4 h-4" />} color="blue" />
            <KpiCard label="Resolved This Week" value={data.resolved_this_week} sub={`${data.resolved_today} resolved today`} icon={<CheckCircle className="w-4 h-4" />} color="green" />
            <KpiCard label="SLA Breached" value={data.sla_breached} sub="Open tickets &gt; 24h" icon={<AlertTriangle className="w-4 h-4" />} color={data.sla_breached > 0 ? 'red' : 'gray'} />
          </div>
        </div>

        {/* KPI row 2 — performance */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Performance</p>
          <div className="grid grid-cols-4 gap-4">
            <KpiCard label="Avg First Response" value={`${data.avg_response_minutes?.toFixed(0) ?? '–'} min`} sub="Inbound to first agent reply" icon={<Clock className="w-4 h-4" />} color="amber" />
            <KpiCard label="Resolution Rate" value={`${data.resolution_rate}%`} sub="Resolved + Closed / Total" icon={<TrendingUp className="w-4 h-4" />} color="teal" />
            <KpiCard label="Total Messages" value={data.total_messages} sub="Across all channels" icon={<MessageSquare className="w-4 h-4" />} color="purple" />
            <KpiCard label="DNC Entries" value={data.dnc_count} sub="Opted-out contacts" icon={<Ban className="w-4 h-4" />} color="gray" />
          </div>
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-2 gap-4">

          {/* Volume chart — 12 months */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Conversation Volume</p>
            <p className="text-xs text-gray-400 mb-4">New tickets per month — last 12 months</p>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={data.volume_by_month} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="tickets" fill="#0d9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Channel breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Channel Breakdown</p>
            <p className="text-xs text-gray-400 mb-4">Messages by channel</p>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={data.channel_breakdown} dataKey="count" nameKey="channel" cx="50%" cy="50%" outerRadius={68} innerRadius={32}>
                    {data.channel_breakdown.map((entry) => (
                      <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel] ?? '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {data.channel_breakdown.map((entry) => {
                  const total = data.channel_breakdown.reduce((s, x) => s + x.count, 0)
                  const pct = total > 0 ? Math.round(entry.count / total * 100) : 0
                  return (
                    <div key={entry.channel}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: CHANNEL_COLORS[entry.channel] ?? '#9ca3af' }} />
                          <span className="text-xs text-gray-600 capitalize">{entry.channel}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-800">{entry.count}</span>
                      </div>
                      <div className="h-1 rounded-full bg-gray-100">
                        <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: CHANNEL_COLORS[entry.channel] ?? '#9ca3af' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-2 gap-4">

          {/* Ticket status breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Ticket Status Breakdown</p>
            <p className="text-xs text-gray-400 mb-4">Current distribution across all statuses</p>
            <div className="space-y-3">
              {data.status_breakdown.filter(s => s.count > 0).map((s) => {
                const pct = data.total_conversations > 0 ? Math.round(s.count / data.total_conversations * 100) : 0
                return (
                  <div key={s.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600">{s.status}</span>
                      <span className="text-xs font-semibold text-gray-800">{s.count} <span className="font-normal text-gray-400">({pct}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sentiment distribution */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Customer Sentiment</p>
            <p className="text-xs text-gray-400 mb-4">AI-classified sentiment across all conversations</p>
            <div className="space-y-3">
              {data.sentiment_distribution.map((s) => {
                const pct = totalSentiment > 0 ? Math.round(s.count / totalSentiment * 100) : 0
                const label = SENTIMENT_LABELS[s.sentiment] ?? s.sentiment
                const color = SENTIMENT_COLORS[s.sentiment] ?? '#9ca3af'
                return (
                  <div key={s.sentiment}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs text-gray-600">{label}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-800">{s.count} <span className="font-normal text-gray-400">({pct}%)</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100">
                      <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── DEMO: Agent Workload ──────────────────────────────────────────── */}
        {workload && (
          <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/60 p-5">
            {/* Demo header */}
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-700">Agent Workload</p>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-700 uppercase tracking-wide">Demo</span>
            </div>
            <p className="text-xs text-amber-600 mb-4">Prototype view — full assignment management to be implemented. Shows who is working on what and highlights unassigned tickets for admin action.</p>

            <div className="grid grid-cols-2 gap-4">
              {/* Agent table */}
              <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-100 bg-amber-50">
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-700">Support Team — Active Tickets</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Agent</th>
                      <th className="text-left px-4 py-2 text-gray-500 font-medium">Email</th>
                      <th className="text-right px-4 py-2 text-gray-500 font-medium">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workload.agents.filter(a => a.role !== 'admin').map(agent => (
                      <tr key={agent.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{agent.name}</td>
                        <td className="px-4 py-2.5 text-gray-500">{agent.email}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            agent.active_tickets === 0 ? 'bg-gray-100 text-gray-400'
                            : agent.active_tickets >= 3 ? 'bg-red-100 text-red-600'
                            : 'bg-teal-100 text-teal-700'
                          }`}>
                            {agent.active_tickets}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Unassigned tickets */}
              <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-red-100 bg-red-50">
                  <UserX className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-600">Unassigned Tickets</span>
                  <span className="ml-auto px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold">{workload.unassigned.length}</span>
                </div>
                {workload.unassigned.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-gray-400">All tickets are assigned</p>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {workload.unassigned.map(conv => (
                      <div key={conv.id} className="px-4 py-3">
                        <p className="font-medium text-gray-800 text-xs truncate">{conv.customer_name}</p>
                        <p className="text-gray-500 text-[11px] truncate mt-0.5">{conv.topic}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-50 text-teal-600 border border-teal-100 capitalize">{conv.status}</span>
                          <span className="text-[10px] text-gray-400">{conv.created_at ? new Date(conv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Top complaint categories */}
        {data.top_issues.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Top Complaint Categories</p>
            <p className="text-xs text-gray-400 mb-4">Most frequent issues reported by customers (from AI analysis)</p>
            <ResponsiveContainer width="100%" height={Math.max(160, data.top_issues.length * 36)}>
              <BarChart data={data.top_issues} layout="vertical" barSize={16}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                <YAxis type="category" dataKey="issue" tick={{ fontSize: 11 }} width={170} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="cases" fill="#6366f1" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </div>
    </div>
  )
}
