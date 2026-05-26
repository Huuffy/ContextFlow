import axios from 'axios'
import type { Conversation, Message, Customer, Transaction, AISummary, Campaign, DNCEntry } from '../types'

const client = axios.create({ baseURL: '/api/v1' })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (r) => r,
  (err) => {
    return Promise.reject(err)
  }
)

export const auth = {
  login: (email: string, password: string) =>
    client.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => client.get('/auth/me').then((r) => r.data),
}

export const conversations = {
  list: (params?: Record<string, string>) =>
    client.get<Conversation[]>('/conversations', { params }).then((r) => r.data),
  get: (id: string) => client.get<Conversation>(`/conversations/${id}`).then((r) => r.data),
  messages: (id: string) =>
    client.get<Message[]>(`/conversations/${id}/messages`).then((r) => r.data),
  assign: (id: string, agent_id: string) =>
    client.post(`/conversations/${id}/assign`, { agent_id }).then((r) => r.data),
  close: (id: string) => client.post(`/conversations/${id}/close`).then((r) => r.data),
}

export const messages = {
  send: (conversation_id: string, content: string, channel: string) =>
    client.post('/messages/send', { conversation_id, content, channel }).then((r) => r.data),
}

export const customers = {
  list: (search?: string) =>
    client.get<Customer[]>('/customers', { params: search ? { search } : {} }).then((r) => r.data),
  get: (id: string) => client.get<Customer>(`/customers/${id}`).then((r) => r.data),
  transactions: (id: string) =>
    client.get<Transaction[]>(`/customers/${id}/transactions`).then((r) => r.data),
  identifiers: (id: string) =>
    client.get(`/customers/${id}/identifiers`).then((r) => r.data),
}

export const ai = {
  summary: (conversation_id: string) =>
    client.get<AISummary>(`/ai/summaries/${conversation_id}`).then((r) => r.data),
  regenerate: (conversation_id: string) =>
    client.post<AISummary>(`/ai/regenerate/${conversation_id}`).then((r) => r.data),
}

export const documents = {
  list: (customer_id: string) =>
    client.get(`/customers/${customer_id}/documents`).then((r) => r.data),
  upload: (customer_id: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('customer_id', customer_id)
    return client.post('/documents/upload', fd).then((r) => r.data)
  },
}

export const campaignsApi = {
  list: () => client.get<Campaign[]>('/campaigns').then((r) => r.data),
  create: (data: { name: string; content_template: string; target_channels: string[]; audience_filter?: Record<string, unknown> }) =>
    client.post<Campaign>('/campaigns', data).then((r) => r.data),
  submitReview: (id: string) => client.post(`/campaigns/${id}/submit-review`).then((r) => r.data),
  approve: (id: string, lockedEmails: string[]) =>
    client.post(`/campaigns/${id}/approve`, { locked_emails: lockedEmails }).then((r) => r.data),
  recipients: (id: string) =>
    client.get<{ email: string; name: string; channels: string[]; is_dnc: boolean }[]>(
      `/campaigns/${id}/recipients`
    ).then((r) => r.data),
  dispatch: (id: string) => client.post(`/campaigns/${id}/dispatch`).then((r) => r.data),
  cancel: (id: string) => client.delete(`/campaigns/${id}`).then((r) => r.data),
}

export const compliance = {
  dncList: () => client.get<DNCEntry[]>('/compliance/dnc-list').then((r) => r.data),
  addDnc: (email: string) =>
    client.post('/compliance/dnc-list', { email }).then((r) => r.data),
  removeDnc: (id: string) => client.delete(`/compliance/dnc-list/${id}`).then((r) => r.data),
  consent: (customer_id: string) =>
    client.get(`/compliance/consent/${customer_id}`).then((r) => r.data),
}

export const analytics = {
  dashboard: () => client.get('/analytics/dashboard').then((r) => r.data),
}

export const test = {
  sendEmail: () => client.post('/test/send-email').then((r) => r.data),
}

export const register = (data: {
  email: string
  name?: string
  whatsapp?: string
  telegram?: string
}) => client.post('/register', data).then((r) => r.data)

export const simulator = {
  send: (channel: string, identifier: string, content: string) =>
    axios.post(`/api/webhooks/simulator/${channel}`, { identifier, content }).then((r) => r.data),
}

export default client
