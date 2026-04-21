import { create } from 'zustand'
import type { Message } from '../types'
import * as chatApi from '../api/chat'

interface ChatState {
  messages: Record<number, Message[]>
  streaming: Record<number, string>
  loading: Record<number, boolean>

  loadMessages: (projectId: number, nodeId: number) => Promise<void>
  sendMessage: (projectId: number, nodeId: number, message: string) => void
  clearStreaming: (nodeId: number) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: {},
  streaming: {},
  loading: {},

  loadMessages: async (projectId, nodeId) => {
    set((s) => ({ loading: { ...s.loading, [nodeId]: true } }))
    const msgs = await chatApi.getMessages(projectId, nodeId)
    set((s) => ({
      messages: { ...s.messages, [nodeId]: msgs },
      loading: { ...s.loading, [nodeId]: false },
    }))
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
        console.error('Chat error:', error)
        set((s) => {
          const newStreaming = { ...s.streaming }
          delete newStreaming[nodeId]
          return { streaming: newStreaming }
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
}))
