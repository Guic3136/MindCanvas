import { create } from 'zustand'
import type { Project, NodeInfo, EdgeInfo, ModelInfo } from '../types'
import * as projectApi from '../api/project'
import * as chatApi from '../api/chat'
import client from '../api/client'

interface CanvasState {
  project: Project | null
  models: ModelInfo[]
  loading: boolean

  loadProject: (id: number) => Promise<void>
  loadModels: () => Promise<void>
  addNode: (modelId: number, position: { x: number; y: number }) => Promise<void>
  updateNodePosition: (nodeId: number, position: { x: number; y: number }) => void
  updateNodeLabel: (nodeId: number, label: string) => Promise<void>
  updateNodeModel: (nodeId: number, modelId: number) => Promise<void>
  removeNode: (nodeId: number) => Promise<void>
  addEdge: (sourceId: number, targetId: number) => Promise<void>
  updateEdgeMode: (edgeId: number, contextMode: string) => Promise<void>
  removeEdge: (edgeId: number) => Promise<void>
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  project: null,
  models: [],
  loading: true,

  loadProject: async (id) => {
    set({ loading: true })
    const project = await projectApi.getProject(id)
    set({ project, loading: false })
  },

  loadModels: async () => {
    const { data } = await client.get<ModelInfo[]>('/admin/models')
    set({ models: data.filter((m) => m.is_enabled) })
  },

  addNode: async (modelId, position) => {
    const { project } = get()
    if (!project) return
    const node = await chatApi.createNode(project.id, {
      model_id: modelId,
      label: `节点 ${(project.nodes?.length || 0) + 1}`,
      position_x: position.x,
      position_y: position.y,
    })
    set((s) => ({
      project: s.project ? { ...s.project, nodes: [...s.project.nodes, node] } : null,
    }))
  },

  updateNodePosition: (nodeId, position) => {
    const { project } = get()
    if (!project) return
    chatApi.updateNode(project.id, nodeId, { position_x: position.x, position_y: position.y })
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

  updateNodeLabel: async (nodeId, label) => {
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
  },

  updateNodeModel: async (nodeId, modelId) => {
    const { project } = get()
    if (!project) return
    await chatApi.updateNode(project.id, nodeId, { model_id: modelId })
    set((s) => ({
      project: s.project
        ? {
            ...s.project,
            nodes: s.project.nodes.map((n) => (n.id === nodeId ? { ...n, model_id: modelId } : n)),
          }
        : null,
    }))
  },

  removeNode: async (nodeId) => {
    const { project } = get()
    if (!project) return
    await chatApi.deleteNode(project.id, nodeId)
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
  },

  addEdge: async (sourceId, targetId) => {
    const { project } = get()
    if (!project) return
    const edge = await chatApi.createEdge(project.id, {
      source_node_id: sourceId,
      target_node_id: targetId,
    })
    set((s) => ({
      project: s.project ? { ...s.project, edges: [...s.project.edges, edge] } : null,
    }))
  },

  updateEdgeMode: async (edgeId, contextMode) => {
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
  },

  removeEdge: async (edgeId) => {
    const { project } = get()
    if (!project) return
    await chatApi.deleteEdge(project.id, edgeId)
    set((s) => ({
      project: s.project ? { ...s.project, edges: s.project.edges.filter((e) => e.id !== edgeId) } : null,
    }))
  },
}))
