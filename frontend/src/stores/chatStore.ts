import { create } from 'zustand'
import type { Message } from '../types'
import * as chatApi from '../api/chat'

interface ChatState {
  messages: Record<number, Message[]>
  streaming: Record<number, string>
  loading: Record<number, boolean>
  errors: Record<number, string | null>

  loadMessages: (projectId: number, nodeId: number) => Promise<void>
  sendMessage: (projectId: number, nodeId: number, message: string) => void
  clearStreaming: (nodeId: number) => void
  clearNodeMessages: (nodeId: number) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  streaming: {},
  loading: {},
  errors: {},

  loadMessages: async (projectId, nodeId) => {
    try {
      set((s) => ({ loading: { ...s.loading, [nodeId]: true }, errors: { ...s.errors, [nodeId]: null } }))
      const msgs = await chatApi.getMessages(projectId, nodeId)
      set((s) => ({
        messages: { ...s.messages, [nodeId]: msgs },
        loading: { ...s.loading, [nodeId]: false },
        errors: { ...s.errors, [nodeId]: null },
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load messages'
      set((s) => ({
        loading: { ...s.loading, [nodeId]: false },
        errors: { ...s.errors, [nodeId]: message },
      }))
      console.error('[chatStore] loadMessages failed:', err)
    }
  },

  sendMessage: (projectId, nodeId, message) => {
    const tempUserMsg: Message = {
      id: Date.now(),
      node_id: nodeId,
      role: 'user',
      content: message,
    }
    set((s) => ({
      messages: { ...s.messages, [nodeId]: [...(s.messages[nodeId] || []), tempUserMsg] },
      streaming: { ...s.streaming, [nodeId]: '' },
      errors: { ...s.errors, [nodeId]: null },
    }))

    chatApi.chatStream(
      projectId,
      nodeId,
      message,
      (token) => {
        set((s) => ({
          streaming: { ...s.streaming, [nodeId]: (s.streaming[nodeId] || '') + token },
        }))
      },
      () => {
        get().loadMessages(projectId, nodeId)
        set((s) => {
          const newStreaming = { ...s.streaming }
          delete newStreaming[nodeId]
          return { streaming: newStreaming }
        })
      },
      (error) => {
        console.error('[chatStore] sendMessage error:', error)
        const errorMessage = typeof error === 'string' ? error : 'Failed to send. Retry.'
        set((s) => {
          const newStreaming = { ...s.streaming }
          delete newStreaming[nodeId]
          const msgs = s.messages[nodeId] || []
          const updated = msgs.map((m) =>
            m.id === tempUserMsg.id ? { ...m, content: errorMessage } : m
          )
          return {
            streaming: newStreaming,
            messages: { ...s.messages, [nodeId]: updated },
            errors: { ...s.errors, [nodeId]: errorMessage },
          }
        })
      }
    )
  },

  clearStreaming: (nodeId) => {
    set((s) => {
      const newStreaming = { ...s.streaming }
      delete newStreaming[nodeId]
      return { streaming: newStreaming }
    })
  },

  clearNodeMessages: (nodeId) => {
    set((s) => {
      const newMessages = { ...s.messages }
      delete newMessages[nodeId]
      const newLoading = { ...s.loading }
      delete newLoading[nodeId]
      const newErrors = { ...s.errors }
      delete newErrors[nodeId]
      return { messages: newMessages, loading: newLoading, errors: newErrors }
    })
  },
}))
