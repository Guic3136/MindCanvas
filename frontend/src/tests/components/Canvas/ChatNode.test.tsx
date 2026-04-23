import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChatNode from '../../../components/Canvas/ChatNode'
import { useCanvasStore } from '../../../stores/canvasStore'
import { useChatStore } from '../../../stores/chatStore'
import * as chatApi from '../../../api/chat'

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
  NodeResizer: () => null,
}))

vi.mock('../../../api/chat', () => ({
  getMessages: vi.fn(),
  chatStream: vi.fn(),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({ project: null, models: [], loading: true, error: { message: null } })
  useChatStore.setState({ messages: {}, streaming: {}, loading: {}, errors: {} })
  vi.clearAllMocks()
})

const defaultCanvasData = { label: 'Test Node', model_id: 1, db_node_id: 1, project_id: 1, node_type: 'chat' }

const defaultProps = {
  id: '1',
  data: defaultCanvasData,
  selected: false,
  type: 'chat',
  zIndex: 0,
  selectable: true,
  deletable: true,
  draggable: true,
  dragging: false,
}

describe('ChatNode', () => {
  it('renders with node title', async () => {
    vi.mocked(chatApi.getMessages).mockResolvedValue([])
    render(<ChatNode {...defaultProps as any} />)
    expect(screen.getByText('Test Node')).toBeInTheDocument()
  })

  it('shows error banner when chatStore has error for this node', async () => {
    vi.mocked(chatApi.getMessages).mockRejectedValue(new Error('Something went wrong'))
    render(<ChatNode {...defaultProps as any} />)
    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })

  it('shows loading placeholder when loading and no messages', async () => {
    vi.mocked(chatApi.getMessages).mockResolvedValue([])
    useChatStore.setState({ loading: { 1: true }, messages: {} })
    render(<ChatNode {...defaultProps as any} />)
    expect(screen.getByText('加载消息中...')).toBeInTheDocument()
  })
})
