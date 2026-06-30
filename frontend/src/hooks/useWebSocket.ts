import { useEffect, useRef } from 'react'
import { useConversationStore } from '../stores/conversationStore'
import { useAuthStore } from '../stores/authStore'
import type { Message, AISummary } from '../types'

export function useWebSocket(agentId: string | null) {
  const wsRef = useRef<WebSocket | null>(null)
  const destroyedRef = useRef(false)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { appendMessage, setSummary, updateConversationOneLine } = useConversationStore()

  useEffect(() => {
    if (!agentId) return
    destroyedRef.current = false

    const connect = () => {
      if (destroyedRef.current) return

      const token = useAuthStore.getState().token
      // Dev: window.location.host = localhost:5173, Vite proxy forwards /ws/* to localhost:8000
      // Prod: VITE_WS_URL = wss://contextflow-XXXX-el.a.run.app (Cloud Run direct, Firebase can't proxy WS)
      const wsBase = import.meta.env.VITE_WS_URL
        ?? ((window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host)
      const url = token
        ? `${wsBase}/ws/agent/${agentId}?token=${encodeURIComponent(token)}`
        : `${wsBase}/ws/agent/${agentId}`
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data)
          if (event.type === 'message_new') {
            const msg = event.data as Message
            appendMessage(msg.conversation_id, msg)
          } else if (event.type === 'summary_ready') {
            const d = event.data
            setSummary(d.conversation_id, d as AISummary)
            if (d.one_liner) {
              updateConversationOneLine(d.conversation_id, d.one_liner, d.sentiment)
            }
          }
        } catch {}
      }

      ws.onclose = () => {
        if (!destroyedRef.current) {
          retryRef.current = setTimeout(connect, 5000)
        }
      }

      ws.onerror = () => {
        // onerror is followed by onclose, which handles reconnect
      }
    }

    connect()

    return () => {
      destroyedRef.current = true
      if (retryRef.current) clearTimeout(retryRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null
        wsRef.current.close()
      }
    }
  }, [agentId])
}
