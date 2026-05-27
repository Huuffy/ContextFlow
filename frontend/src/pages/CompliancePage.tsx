import { useState, useEffect } from 'react'
import { Shield, Mail, Trash2, AlertTriangle, Info } from 'lucide-react'
import { compliance } from '../services/api'
import type { DNCEntry } from '../types'

export default function CompliancePage() {
  const [dncList, setDncList] = useState<DNCEntry[]>([])
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { compliance.dncList().then(setDncList) }, [])

  const add = async () => {
    const val = email.trim().toLowerCase()
    if (!val || !val.includes('@')) { setError('Enter a valid email address'); return }
    setError('')
    setAdding(true)
    try {
      const entry = await compliance.addDnc(val)
      setDncList((prev) => [entry, ...prev])
      setEmail('')
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to add entry')
    } finally {
      setAdding(false)
    }
  }

  const remove = async (id: string) => {
    await compliance.removeDnc(id)
    setDncList((prev) => prev.filter((d) => d.id !== id))
  }

  const emailEntries = dncList.filter((d) => d.identifier_type === 'email')
  const otherEntries = dncList.filter((d) => d.identifier_type !== 'email')

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-500" />
          <h1 className="text-lg font-semibold text-gray-900">Compliance</h1>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">Do Not Contact list — blocks all outbound messages to the customer</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* How it works */}
        <div className="flex gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-700 space-y-1">
            <p className="font-medium">How DNC works in ContextFlow</p>
            <p>Email is the primary identity key. Adding an email blocks <strong>all channels</strong> (WhatsApp, Telegram, Instagram, Email) for that customer — agents cannot send any outbound message.</p>
            <p>Customers can self-opt-out by sending exactly <strong>"opt out"</strong> on any channel. The system automatically adds their email and sends an acknowledgement.</p>
          </div>
        </div>

        {/* Add to DNC */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            Add email to DNC list
          </h3>
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder="customer@example.com"
              type="email"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
            />
            <button
              onClick={add}
              disabled={adding}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {adding ? 'Adding…' : 'Block email'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />{error}
            </p>
          )}
        </div>

        {/* Active DNC list — emails */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Blocked emails</p>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {emailEntries.length} active
            </span>
          </div>
          {emailEntries.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">No emails blocked</div>
          ) : (
            emailEntries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-3.5 h-3.5 text-red-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.identifier}</p>
                    {entry.customer_name && (
                      <p className="text-xs text-gray-400 truncate">{entry.customer_name}</p>
                    )}
                    {!entry.customer_name && (
                      <p className="text-xs text-gray-400">Unknown customer</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-gray-400">
                    {new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                  <button
                    onClick={() => remove(entry.id)}
                    title="Remove from DNC"
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>


      </div>
    </div>
  )
}
