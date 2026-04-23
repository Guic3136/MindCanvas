import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from '../../stores/chatStore'

const chatStreamMock = vi.fn((..._args: any[]) => ({ cancel: vi.fn() }))

vi.mock('../../api/chat', () => ({
  getMessages: vi.fn(),
  chatStream: (...args: any[]) => chatStreamMock(...args),
}))

beforeEach(() => {
  useChatStore.setState({ messages: {}, streaming: {}, loading: {}, errors: {} })
  chatStreamMock.mockClear()
})

describe('chatStore', () => {
  it('addMessage via sendMessage adds a message to the state', () => {
    chatStreamMock.mockImplementation(() => ({ cancel: vi.fn() }))
    useChatStore.getState().sendMessage(1, 1, 'hello')
    const msgs = useChatStore.getState().messages[1]
    expect(msgs).toHaveLength(1)
    expect(msgs![0].content).toBe('hello')
    expect(msgs![0].role).toBe('user')
  })

  it('clearNodeMessages clears messages for a node', () => {
    chatStreamMock.mockImplementation(() => ({ cancel: vi.fn() }))
    const state = useChatStore.getState()
    state.sendMessage(1, 1, 'hello')
    state.clearNodeMessages(1)
    expect(useChatStore.getState().messages[1]).toBeUndefined()
    expect(useChatStore.getState().loading[1]).toBeUndefined()
    expect(useChatStore.getState().errors[1]).toBeUndefined()
  })

  it('setStreaming sets streaming state', () => {
    chatStreamMock.mockImplementation(
      (_pid: any, _nid: any, _msg: any, onToken: any) => {
        onToken('chunk')
        return { cancel: vi.fn() }
      }
    )
    useChatStore.getState().sendMessage(1, 1, 'hello')
    expect(useChatStore.getState().streaming[1]).toBe('chunk')
  })
})
