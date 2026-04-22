import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from '../../stores/canvasStore'
import type { Project } from '../../types'

const mockProject: Project = {
  id: 1,
  name: 'test',
  owner_id: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  nodes: [],
  edges: [],
}

vi.mock('../../api/project', () => ({
  getProject: vi.fn(),
}))

vi.mock('../../api/chat', () => ({
  createNode: vi.fn(),
  updateNode: vi.fn().mockResolvedValue({}),
  deleteNode: vi.fn(),
  createEdge: vi.fn(),
  updateEdge: vi.fn(),
  deleteEdge: vi.fn(),
}))

vi.mock('../../api/client', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [] }) },
}))

vi.mock('../../stores/chatStore', () => ({
  useChatStore: { getState: vi.fn(() => ({ clearNodeMessages: vi.fn() })) },
}))

import * as projectApi from '../../api/project'
import * as chatApi from '../../api/chat'

beforeEach(() => {
  useCanvasStore.setState({ project: null, models: [], loading: true, error: { message: null } })
  vi.clearAllMocks()
})

describe('canvasStore', () => {
  it('addNode adds a node to the state', async () => {
    vi.mocked(projectApi.getProject).mockResolvedValue(mockProject)
    await useCanvasStore.getState().loadProject(1)

    const newNode = { id: 1, model_id: 1, label: 'Node 1', position_x: 0, position_y: 0, width: 400, height: 500 }
    vi.mocked(chatApi.createNode).mockResolvedValue(newNode)

    await useCanvasStore.getState().addNode(1, { x: 0, y: 0 })
    expect(useCanvasStore.getState().project?.nodes).toHaveLength(1)
  })

  it('removeNode removes a node', async () => {
    const projectWithNode: Project = {
      ...mockProject,
      nodes: [{ id: 1, model_id: 1, label: 'Node 1', position_x: 0, position_y: 0, width: 400, height: 500 }],
      edges: [],
    }
    vi.mocked(projectApi.getProject).mockResolvedValue(projectWithNode)
    await useCanvasStore.getState().loadProject(1)

    vi.mocked(chatApi.deleteNode).mockResolvedValue(undefined)

    await useCanvasStore.getState().removeNode(1)
    expect(useCanvasStore.getState().project?.nodes).toHaveLength(0)
  })

  it('updateNodePosition updates position', async () => {
    const projectWithNode: Project = {
      ...mockProject,
      nodes: [{ id: 1, model_id: 1, label: 'Node 1', position_x: 0, position_y: 0, width: 400, height: 500 }],
      edges: [],
    }
    vi.mocked(projectApi.getProject).mockResolvedValue(projectWithNode)
    await useCanvasStore.getState().loadProject(1)

    useCanvasStore.getState().updateNodePosition(1, { x: 100, y: 200 })
    const node = useCanvasStore.getState().project?.nodes[0]
    expect(node?.position_x).toBe(100)
    expect(node?.position_y).toBe(200)
  })

  it('loadProject sets error state on failure', async () => {
    vi.mocked(projectApi.getProject).mockRejectedValue(new Error('Network error'))
    await useCanvasStore.getState().loadProject(1)
    expect(useCanvasStore.getState().error.message).toBe('Network error')
    expect(useCanvasStore.getState().loading).toBe(false)
  })
})
