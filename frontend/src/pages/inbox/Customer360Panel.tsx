import React, { useEffect, useState } from 'react'
import { Mail, Phone, Send, MessageSquare, Monitor, Link, CreditCard } from 'lucide-react'
import { useConversationStore } from '../../stores/conversationStore'
import { customers, ai, documents, accounts } from '../../services/api'
import type { Conversation, Customer, Transaction, AccountTransaction, BankAccount } from '../../types'

const channelIcons: Record<string, React.ReactElement> = {
  whatsapp:  <Phone className="w-3 h-3" />,
  instagram: <MessageSquare className="w-3 h-3" />,
  email:     <Mail className="w-3 h-3" />,
  telegram:  <Send className="w-3 h-3" />,
  simulator: <Monitor className="w-3 h-3" />,
}

const channelColors: Record<string, string> = {
  whatsapp:  'bg-green-100 text-green-700',
  instagram: 'bg-pink-100 text-pink-700',
  email:     'bg-blue-100 text-blue-700',
  telegram:  'bg-sky-100 text-sky-700',
  simulator: 'bg-gray-100 text-gray-500',
}

const sentimentColors: Record<string, string> = {
  positive: 'bg-green-100 text-green-700',
  neutral: 'bg-gray-100 text-gray-600',
  negative: 'bg-red-100 text-red-700',
  frustrated: 'bg-orange-100 text-orange-700',
}

const AMOUNT_RE = /(?:₹|rs\.?)\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/gi
const PLAIN_NUM_RE = /\b(\d{2,6})\b/g
const DATE_RE = /\b(\d{1,2})[/-](\d{1,2})\b|\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})\b/gi

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function parseAmountsFromMessages(messages: { content: string }[]): number[] {
  const amounts = new Set<number>()
  for (const msg of messages) {
    const text = msg.content

    // ₹ / rs amounts
    let m: RegExpExecArray | null
    AMOUNT_RE.lastIndex = 0
    while ((m = AMOUNT_RE.exec(text)) !== null) {
      const val = parseFloat(m[1].replace(/,/g, ''))
      if (!isNaN(val)) amounts.add(val)
    }

    // Plain numbers (2-6 digits) in transaction-related context
    PLAIN_NUM_RE.lastIndex = 0
    while ((m = PLAIN_NUM_RE.exec(text)) !== null) {
      const val = parseFloat(m[1])
      if (!isNaN(val) && val >= 10 && val <= 999999) amounts.add(val)
    }
  }
  return Array.from(amounts)
}

interface ParsedDate { month: number; day: number }

function parseDatesFromMessages(messages: { content: string }[]): ParsedDate[] {
  const dates: ParsedDate[] = []
  for (const msg of messages) {
    const text = msg.content
    DATE_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = DATE_RE.exec(text)) !== null) {
      if (m[1] && m[2]) {
        // dd/mm or dd-mm
        dates.push({ day: parseInt(m[1]), month: parseInt(m[2]) })
      } else if (m[3] && m[4]) {
        // 25 may
        dates.push({ day: parseInt(m[3]), month: MONTH_MAP[m[4].toLowerCase()] })
      } else if (m[5] && m[6]) {
        // may 25
        dates.push({ day: parseInt(m[6]), month: MONTH_MAP[m[5].toLowerCase()] })
      }
    }
  }
  return dates
}

function isRelevantTransaction(
  tx: AccountTransaction,
  amounts: number[],
  parsedDates: ParsedDate[],
): boolean {
  // Amount match (±10 tolerance)
  const txAmt = tx.amount
  if (amounts.some((a) => Math.abs(a - txAmt) <= 10)) return true

  // Date match: check month and day
  const txDate = new Date(tx.transaction_date)
  const txMonth = txDate.getMonth() + 1
  const txDay = txDate.getDate()
  if (parsedDates.some((d) => d.month === txMonth && d.day === txDay)) return true

  return false
}

interface Props {
  conversation: Conversation | null
}

export default function Customer360Panel({ conversation }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [identifiers, setIdentifiers] = useState<{channel: string, identifier: string}[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accountTxs, setAccountTxs] = useState<AccountTransaction[]>([])
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null)
  const [docs, setDocs] = useState<any[]>([])
  const [loadingRegen, setLoadingRegen] = useState(false)
  const [showAllTxs, setShowAllTxs] = useState(false)
  const { summaries, setSummary } = useConversationStore()
  const storeMessages = useConversationStore((s) => s.messages)

  const summary = conversation ? summaries[conversation.id] : null

  // Get messages from store for relevance parsing
  const convMessages = conversation ? (storeMessages[conversation.id] ?? []) : []

  useEffect(() => {
    if (!conversation?.customer_id) { setCustomer(null); return }
    customers.get(conversation.customer_id).then(setCustomer)
    customers.identifiers(conversation.customer_id).then(setIdentifiers).catch(() => setIdentifiers([]))
    documents.list(conversation.customer_id).then(setDocs)
  }, [conversation?.customer_id])

  // Fetch transactions: account-based if linked, otherwise customer-based
  useEffect(() => {
    if (!conversation) return

    if (conversation.linked_account_number) {
      setTransactions([])
      accounts.get(conversation.linked_account_number)
        .then(setBankAccount)
        .catch(() => setBankAccount(null))
      accounts.transactions(conversation.linked_account_number)
        .then(setAccountTxs)
        .catch(() => setAccountTxs([]))
    } else {
      setBankAccount(null)
      setAccountTxs([])
      if (conversation.customer_id) {
        customers.transactions(conversation.customer_id).then(setTransactions)
      }
    }
  }, [conversation?.customer_id, conversation?.linked_account_number])

  useEffect(() => {
    if (!conversation?.id) return
    ai.summary(conversation.id).then(setSummary.bind(null, conversation.id)).catch(() => {})
  }, [conversation?.id])

  // Reset show-all when conversation changes
  useEffect(() => {
    setShowAllTxs(false)
  }, [conversation?.id])

  const regenerate = async () => {
    if (!conversation) return
    setLoadingRegen(true)
    try {
      const s = await ai.regenerate(conversation.id)
      setSummary(conversation.id, s)
    } finally {
      setLoadingRegen(false)
    }
  }

  const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !conversation?.customer_id) return
    await documents.upload(conversation.customer_id, e.target.files[0])
    documents.list(conversation.customer_id).then(setDocs)
  }

  if (!conversation) {
    return <div className="h-full bg-white border-l border-gray-200 flex items-center justify-center text-gray-300 text-sm">Select a conversation</div>
  }

  // Compute relevant vs rest for account transactions
  const isLinked = !!conversation.linked_account_number
  let relevantTxs: AccountTransaction[] = []
  let otherTxs: AccountTransaction[] = []

  if (isLinked && accountTxs.length > 0) {
    const parsedAmounts = parseAmountsFromMessages(convMessages)
    const parsedDates = parseDatesFromMessages(convMessages)
    relevantTxs = accountTxs.filter((tx) => isRelevantTransaction(tx, parsedAmounts, parsedDates))
    otherTxs = accountTxs.filter((tx) => !isRelevantTransaction(tx, parsedAmounts, parsedDates))
  }

  const hasRelevanceSplit = relevantTxs.length > 0 && otherTxs.length > 0
  const displayedAccountTxs = isLinked
    ? (showAllTxs || !hasRelevanceSplit ? accountTxs : [...relevantTxs, ...otherTxs.slice(0, 3)])
    : []

  return (
    <div className="h-full bg-white border-l border-gray-200 overflow-y-auto min-h-0">
      {/* Customer info */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">{customer?.display_name ?? '…'}</h3>
            {customer?.email && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <Mail className="w-3 h-3 flex-shrink-0" />{customer.email}
              </p>
            )}
            {customer?.phone && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Phone className="w-3 h-3 flex-shrink-0" />{customer.phone}
              </p>
            )}
          </div>
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm flex-shrink-0">
            {customer?.display_name?.[0] ?? '?'}
          </div>
        </div>

        {/* Linked account badge */}
        {isLinked && bankAccount && (
          <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-lg">
            <CreditCard className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-purple-800">Acct #{bankAccount.account_number}</span>
              <span className="text-xs text-purple-600 ml-1.5 capitalize">{bankAccount.account_type}</span>
            </div>
            <span className={`text-xs font-semibold ${bankAccount.balance < 0 ? 'text-red-600' : 'text-purple-700'}`}>
              ₹{Math.abs(bankAccount.balance).toLocaleString('en-IN')}{bankAccount.balance < 0 ? ' (−)' : ''}
            </span>
          </div>
        )}

        {/* Linked channel identifiers */}
        {identifiers.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-400 flex items-center gap-1 mb-1.5">
              <Link className="w-3 h-3" /> Linked channels
            </p>
            <div className="space-y-1">
              {identifiers.map((ci, i) => (
                <div key={i} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg ${channelColors[ci.channel] ?? 'bg-gray-100 text-gray-600'}`}>
                  {channelIcons[ci.channel]}
                  <span className="font-medium capitalize">{ci.channel}</span>
                  <span className="opacity-70 truncate">{ci.identifier}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Summary */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Summary</h4>
          <button
            onClick={regenerate}
            disabled={loadingRegen}
            className="text-xs text-primary-600 hover:text-primary-800 disabled:opacity-50"
          >
            {loadingRegen ? 'Generating…' : 'Regenerate'}
          </button>
        </div>

        {summary ? (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-800">{summary.detailed_summary}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0 font-medium ${sentimentColors[summary.sentiment] ?? 'bg-gray-100 text-gray-600'}`}>
                {summary.sentiment}
              </span>
            </div>
            {summary.key_issues?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Key Issues</p>
                <ul className="space-y-0.5">
                  {summary.key_issues.map((issue, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-1">
                      <span className="text-primary-500 mt-0.5">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.suggested_action && (
              <div className="bg-primary-50 rounded-lg p-2">
                <p className="text-xs font-medium text-primary-700">Suggested Action</p>
                <p className="text-xs text-primary-600 mt-0.5">{summary.suggested_action}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Waiting for summary…</p>
        )}
      </div>

      {/* Transactions section */}
      <div className="p-4 border-b border-gray-100">
        {isLinked ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Account {conversation.linked_account_number} Transactions
              </h4>
              {hasRelevanceSplit && (
                <button
                  onClick={() => setShowAllTxs((v) => !v)}
                  className="text-[10px] text-purple-600 hover:text-purple-800 font-medium transition-colors"
                >
                  {showAllTxs ? 'Show relevant' : 'Show all'}
                </button>
              )}
            </div>

            {accountTxs.length === 0 && (
              <p className="text-xs text-gray-400">No transactions found</p>
            )}

            {displayedAccountTxs.map((tx) => {
              const isRelevant = relevantTxs.some((r) => r.id === tx.id)
              return (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between py-1.5 pl-2 -ml-2 rounded ${
                    isRelevant && hasRelevanceSplit ? 'border-l-2 border-amber-400 pl-2.5' : ''
                  }`}
                >
                  <div>
                    <p className="text-xs font-medium text-gray-800">{tx.merchant_name}</p>
                    <p className="text-xs text-gray-400">{tx.merchant_category} · {tx.transaction_date}</p>
                  </div>
                  <span className={`text-xs font-semibold ${tx.transaction_type === 'credit' ? 'text-green-600' : 'text-gray-700'}`}>
                    {tx.transaction_type === 'credit' ? '+' : '−'}₹{Number(tx.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              )
            })}

            {!showAllTxs && hasRelevanceSplit && otherTxs.length > 3 && (
              <p className="text-[10px] text-gray-400 mt-1">
                +{otherTxs.length - 3} more — <button onClick={() => setShowAllTxs(true)} className="text-purple-600 hover:underline">show all</button>
              </p>
            )}
          </>
        ) : (
          <>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Transactions</h4>
            {transactions.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-xs font-medium text-gray-800">{tx.merchant_name}</p>
                  <p className="text-xs text-gray-400">{tx.merchant_category} · {tx.transaction_date}</p>
                </div>
                <span className="text-xs font-semibold text-gray-700">₹{Number(tx.amount).toLocaleString('en-IN')}</span>
              </div>
            ))}
            {transactions.length === 0 && <p className="text-xs text-gray-400">No transactions</p>}
          </>
        )}
      </div>

      {/* Documents */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Documents</h4>
          <label className="text-xs text-primary-600 hover:text-primary-800 cursor-pointer">
            Upload
            <input type="file" accept=".pdf,.csv" className="hidden" onChange={uploadFile} />
          </label>
        </div>
        {docs.map((doc: any) => (
          <div key={doc.id} className="flex items-center gap-2 py-1.5">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-700 truncate">{doc.filename}</p>
              <p className="text-xs text-gray-400">{doc.processed ? `${doc.chunk_count} chunks` : 'Processing…'}</p>
            </div>
          </div>
        ))}
        {docs.length === 0 && <p className="text-xs text-gray-400">No documents</p>}
      </div>
    </div>
  )
}
