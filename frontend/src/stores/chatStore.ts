import { create } from 'zustand'
import type { Message } from '../types'
import * as chatApi from '../api/chat'

interface ChatState {
  messages: Record<number, Message[]>
  streaming: Record<number, string>
  loading: Record<number, boolean>
  errors: Record<number, string | null>
  cancellers: Record<number, () => void>

  loadMessages: (projectId: number, nodeId: number) => Promise<void>
  sendMessage: (projectId: number, nodeId: number, message: string) => void
  cancelStream: (nodeId: number) => void
  clearStreaming: (nodeId: number) => void
  clearNodeMessages: (nodeId: number) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  streaming: {},
  loading: {},
  errors: {},
  cancellers: {},

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

    const { cancel } = chatApi.chatStream(
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
          const newCancellers = { ...s.cancellers }
          delete newCancellers[nodeId]
          return { streaming: newStreaming, cancellers: newCancellers }
        })
      },
      (error) => {
        console.error('[chatStore] sendMessage error:', error)
        const errorMessage = typeof error === 'string' ? error : '发送失败，请重试'
        set((s) => {
          const newStreaming = { ...s.streaming }
          delete newStreaming[nodeId]
          const newCancellers = { ...s.cancellers }
          delete newCancellers[nodeId]
          // Keep the original user message, set error separately
          return {
            streaming: newStreaming,
            cancellers: newCancellers,
            errors: { ...s.errors, [nodeId]: errorMessage },
          }
        })
      }
    )

    set((s) => ({
      cancellers: { ...s.cancellers, [nodeId]: cancel },
    }))
  },

  cancelStream: (nodeId) => {
    const { cancellers } = get()
    const cancel = cancellers[nodeId]
    if (cancel) {
      cancel()
      set((s) => {
        const newStreaming = { ...s.streaming }
        delete newStreaming[nodeId]
        const newCancellers = { ...s.cancellers }
        delete newCancellers[nodeId]
        // Reload messages to get the partial response saved by backend
        return { streaming: newStreaming, cancellers: newCancellers }
      })
      // Reload to get any partial messages saved by backend
      const msgs = get().messages[nodeId]
      if (msgs && msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg.role === 'user') {
          // The stream was cancelled before any response, just clean up
        }
      }
    }
  },

  clearStreaming: (nodeId) => {
    set((s) => {
      const newStreaming = { ...s.streaming }
      delete newStreaming[nodeId]
      const newCancellers = { ...s.cancellers }
      delete newCancellers[nodeId]
      return { streaming: newStreaming, cancellers: newCancellers }
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
      const newCancellers = { ...s.cancellers }
      delete newCancellers[nodeId]
      return { messages: newMessages, loading: newLoading, errors: newErrors, cancellers: newCancellers }
    })
  },
}))
