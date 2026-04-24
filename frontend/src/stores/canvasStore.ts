import { create } from 'zustand'
import { toast } from 'sonner'
import type { Project, NodeInfo, EdgeInfo, ModelInfo, PaginatedResponse } from '../types'
import * as projectApi from '../api/project'
import * as chatApi from '../api/chat'
import client from '../api/client'
import { useChatStore } from './chatStore'

interface CanvasState {
  project: Project | null
  models: ModelInfo[]
  loading: boolean
  error: { message: string | null; node?: string }

  loadProject: (id: number) => Promise<void>
  loadModels: () => Promise<void>
  addNode: (modelId: number, position: { x: number; y: number }, nodeType?: string, extraData?: Partial<NodeInfo>) => Promise<void>
  updateNodePosition: (nodeId: number, position: { x: number; y: number }) => void
  updateNodeSize: (nodeId: number, size: { width: number; height: number }) => void
  updateNodeLabel: (nodeId: number, label: string) => Promise<void>
  updateNodeModel: (nodeId: number, modelId: number) => Promise<void>
  removeNode: (nodeId: number) => Promise<void>
  addEdge: (sourceId: number, targetId: number, routeTag?: string) => Promise<void>
  updateEdgeMode: (edgeId: number, contextMode: string) => Promise<void>
  removeEdge: (edgeId: number) => Promise<void>
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  project: null,
  models: [],
  loading: true,
  error: { message: null },

  loadProject: async (id) => {
    try {
      set({ loading: true, error: { message: null } })
      const project = await projectApi.getProject(id)
      set({ project, loading: false, error: { message: null } })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load project'
      set({ loading: false, error: { message } })
      console.error('[canvasStore] loadProject failed:', err)
    }
  },

  loadModels: async () => {
    try {
      const { data } = await client.get<PaginatedResponse<ModelInfo>>('/admin/models')
      set({ models: data.items.filter((m) => m.is_enabled) })
    } catch (err) {
      console.error('[canvasStore] loadModels failed:', err)
    }
  },

  addNode: async (modelId, position, nodeType = 'chat', extraData = {}) => {
    try {
      const { project } = get()
      if (!project) return
      const labelMap: Record<string, string> = {
        chat: '对话',
        file: '文件',
        note: '便签',
        web: '网页',
        transform: '转换',
        compare: '对比',
        code: '代码',
        image_gen: '生图',
      }
      const typeCount = project.nodes?.filter((n) => n.node_type === nodeType).length || 0
      const node = await chatApi.createNode(project.id, {
        model_id: modelId,
        node_type: nodeType,
        label: `${labelMap[nodeType] || '节点'} ${typeCount + 1}`,
        position_x: position.x,
        position_y: position.y,
        ...extraData,
      })
      set((s) => ({
        project: s.project ? { ...s.project, nodes: [...s.project.nodes, node] } : null,
        error: { message: null },
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add node'
      set({ error: { message } })
      console.error('[canvasStore] addNode failed:', err)
    }
  },

  updateNodePosition: (nodeId, position) => {
    const { project } = get()
    if (!project) return
    chatApi.updateNode(project.id, nodeId, { position_x: position.x, position_y: position.y }).catch((err) => {
      console.error('[canvasStore] updateNodePosition failed:', err)
    })
    set((s) => ({
      project: s.project
        ? {
            ...s.project,
            nodes: s.project.nodes.map((n) =>
              n.id === nodeId ? { ...n, position_x: position.x, position_y: position.y } : n
            ),
          }
        : null,
    }))
  },

  updateNodeSize: (nodeId, size) => {
    const { project } = get()
    if (!project) return
    chatApi.updateNode(project.id, nodeId, { width: size.width, height: size.height }).catch((err) => {
      console.error('[canvasStore] updateNodeSize failed:', err)
    })
    set((s) => ({
      project: s.project
        ? {
            ...s.project,
            nodes: s.project.nodes.map((n) =>
              n.id === nodeId ? { ...n, width: size.width, height: size.height } : n
            ),
          }
        : null,
    }))
  },

  updateNodeLabel: async (nodeId, label) => {
    try {
      const { project } = get()
      if (!project) return
      await chatApi.updateNode(project.id, nodeId, { label })
      set((s) => ({
        project: s.project
          ? {
              ...s.project,
              nodes: s.project.nodes.map((n) => (n.id === nodeId ? { ...n, label } : n)),
            }
          : null,
      }))
    } catch (err) {
      console.error('[canvasStore] updateNodeLabel failed:', err)
    }
  },

  updateNodeModel: async (nodeId, modelId) => {
    try {
      const { project, models } = get()
      if (!project) return
      const newModel = models.find((m) => m.id === modelId)
      const incomingEdges = project.edges.filter((e) => e.target_node_id === nodeId)
      const hasImageSource = incomingEdges.some((e) => {
        const sourceNode = project.nodes.find((n) => n.id === e.source_node_id)
        return sourceNode?.node_type === 'file' && sourceNode.file_type === 'image'
      })
      if (hasImageSource && newModel && !newModel.supports_vision) {
        toast.error('当前节点有来自图片文件节点的连线，无法切换到不支持 Vision 的模型')
        return
      }
      await chatApi.updateNode(project.id, nodeId, { model_id: modelId })
      set((s) => ({
        project: s.project
          ? {
              ...s.project,
              nodes: s.project.nodes.map((n) => (n.id === nodeId ? { ...n, model_id: modelId } : n)),
            }
          : null,
      }))
    } catch (err) {
      console.error('[canvasStore] updateNodeModel failed:', err)
    }
  },

  removeNode: async (nodeId) => {
    try {
      const { project } = get()
      if (!project) return
      await chatApi.deleteNode(project.id, nodeId)
      useChatStore.getState().clearNodeMessages(nodeId)
      set((s) => ({
        project: s.project
          ? {
              ...s.project,
              nodes: s.project.nodes.filter((n) => n.id !== nodeId),
              edges: s.project.edges.filter(
                (e) => e.source_node_id !== nodeId && e.target_node_id !== nodeId
              ),
            }
          : null,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove node'
      set({ error: { message, node: String(nodeId) } })
      console.error('[canvasStore] removeNode failed:', err)
    }
  },

  addEdge: async (sourceId, targetId, routeTag?: string) => {
    try {
      const { project } = get()
      if (!project) return
      const edge = await chatApi.createEdge(project.id, {
        source_node_id: sourceId,
        target_node_id: targetId,
        route_tag: routeTag,
      })
      set((s) => ({
        project: s.project ? { ...s.project, edges: [...s.project.edges, edge] } : null,
      }))
    } catch (err: unknown) {
      // 409 = edge already exists, silently ignore (frontend guard may have raced)
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) return
      const message = err instanceof Error ? err.message : 'Failed to add edge'
      set({ error: { message } })
      console.error('[canvasStore] addEdge failed:', err)
    }
  },

  updateEdgeMode: async (edgeId, contextMode) => {
    try {
      const { project } = get()
      if (!project) return
      await chatApi.updateEdge(project.id, edgeId, { context_mode: contextMode })
      set((s) => ({
        project: s.project
          ? {
              ...s.project,
              edges: s.project.edges.map((e) =>
                e.id === edgeId ? { ...e, context_mode: contextMode } : e
              ),
            }
          : null,
      }))
    } catch (err) {
      console.error('[canvasStore] updateEdgeMode failed:', err)
    }
  },

  removeEdge: async (edgeId) => {
    try {
      const { project } = get()
      if (!project) return
      await chatApi.deleteEdge(project.id, edgeId)
      set((s) => ({
        project: s.project ? { ...s.project, edges: s.project.edges.filter((e) => e.id !== edgeId) } : null,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove edge'
      set({ error: { message } })
      console.error('[canvasStore] removeEdge failed:', err)
    }
  },
}))
