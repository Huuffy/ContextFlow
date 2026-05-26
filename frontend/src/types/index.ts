export type Channel = 'whatsapp' | 'instagram' | 'email' | 'telegram' | 'simulator'

export interface Agent {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}

export interface Customer {
  id: string
  display_name: string
  email?: string
  phone?: string
  metadata_json?: string
  created_at: string
}

export interface ChannelIdentifier {
  id: string
  customer_id: string
  channel: Channel
  identifier: string
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: 'customer' | 'agent' | 'system'
  direction: 'inbound' | 'outbound'
  channel: Channel
  content: string
  media_url?: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  created_at: string
}

export interface AISummary {
  id: string
  conversation_id: string
  one_liner: string
  detailed_summary: string
  key_issues: string[]
  suggested_action: string
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated'
  generated_at: string
}

export interface Conversation {
  id: string
  customer_id: string
  assigned_agent_id?: string
  status: 'open' | 'waiting' | 'resolved' | 'closed'
  active_channels: Channel[]
  priority: number
  topic?: string
  last_message_at?: string
  created_at: string
  customer_name?: string
  one_liner?: string
  sentiment?: string
}

export interface Transaction {
  id: string
  customer_id: string
  amount: number
  merchant_name: string
  merchant_category: string
  transaction_date: string
}

export interface Campaign {
  id: string
  name: string
  status: string
  target_channels: string[]
  audience_filter: Record<string, unknown>
  content_template: string
  scheduled_at?: string
  sent_count: number
  delivered_count: number
  created_at: string
}

export interface DNCEntry {
  id: string
  identifier: string
  identifier_type: 'phone' | 'email'
  is_active: boolean
  created_at: string
  customer_name?: string
}
