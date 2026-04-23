import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { MousePointer2, GitBranchPlus, Send, X, HelpCircle } from 'lucide-react'
import ChatNode from './ChatNode'
import CustomEdge from './CustomEdge'
import CanvasToolbar from './CanvasToolbar'
import { useCanvasStore } from '../../stores/canvasStore'
import * as projectApi from '../../api/project'
import client from '../../api/client'

const nodeTypes = { chat: ChatNode }
const edgeTypes = { custom: CustomEdge }

function FlowCanvasInner() {
  const { id: projectIdStr } = useParams()
  const projectId = Number(projectIdStr)
  const { project, models, error, loadProject, loadModels, addNode, updateNodePosition, addEdge: addDbEdge, updateEdgeMode, removeEdge: removeDbEdge } = useCanvasStore()

  const [projectName, setProjectName] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Show onboarding when project loads with no nodes
  useEffect(() => {
    if (project && project.nodes.length === 0) {
      setShowOnboarding(true)
    }
  }, [project])

  useEffect(() => {
    loadProject(projectId)
    loadModels()
  }, [projectId, loadProject, loadModels])

  useEffect(() => {
    if (project) setProjectName(project.name)
  }, [project])

  // Convert DB nodes to React Flow nodes
  const rfNodes: Node[] = useMemo(() => {
    if (!project) return []
    return project.nodes.map((n) => ({
      id: String(n.id),
      type: 'chat',
      position: { x: n.position_x, y: n.position_y },
      data: { label: n.label, model_id: n.model_id, db_node_id: n.id, project_id: projectId },
    }))
  }, [project, projectId])

  // Convert DB edges to React Flow edges
  const rfEdges: Edge[] = useMemo(() => {
    if (!project) return []
    return project.edges.map((e) => ({
      id: String(e.id),
      source: String(e.source_node_id),
      target: String(e.target_node_id),
      type: 'custom',
      data: {
        context_mode: e.context_mode,
        db_edge_id: e.id,
        onModeChange: (edgeId: number, mode: string) => updateEdgeMode(edgeId, mode),
        onRemove: (edgeId: number) => removeDbEdge(edgeId),
      },
    }))
  }, [project, updateEdgeMode, removeDbEdge])

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync node add/remove and data changes (position changes are handled by onNodesChange + onNodeDragStop)
  useEffect(() => {
    const currentIds = new Set(nodes.map((n) => n.id))
    const incomingIds = new Set(rfNodes.map((n) => n.id))
    const idsChanged = currentIds.size !== incomingIds.size || [...currentIds].some((id) => !incomingIds.has(id))
    const dataChanged = rfNodes.some((incoming) => {
      const current = nodes.find((n) => n.id === incoming.id)
      return !current || current.data.model_id !== incoming.data.model_id || current.data.label !== incoming.data.label
    })
    if (idsChanged || dataChanged) {
      setNodes(rfNodes)
    }
  }, [rfNodes, setNodes])

  // Sync edge add/remove only
  useEffect(() => {
    const currentIds = new Set(edges.map((e) => e.id))
    const incomingIds = new Set(rfEdges.map((e) => e.id))
    if (currentIds.size !== incomingIds.size || [...currentIds].some((id) => !incomingIds.has(id))) {
      setEdges(rfEdges)
    }
  }, [rfEdges, setEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    addDbEdge(Number(connection.source), Number(connection.target))
  }, [addDbEdge])

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    updateNodePosition(Number(node.id), node.position)
  }, [updateNodePosition])

  const handleAddNode = useCallback(() => {
    if (models.length === 0) {
      toast.error('请先在管理员页面添加模型')
      return
    }
    const center = { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 }
    addNode(models[0].id, center)
  }, [models, addNode])

  const handleExport = useCallback(async () => {
    const { data } = await client.post(`/projects/${projectId}/export`, {}, { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([data], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectName || 'project'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [projectId, projectName])

  const handleNameChange = useCallback(async (name: string) => {
    setProjectName(name)
    if (name.trim()) {
      await client.put(`/projects/${projectId}`, { name: name.trim() })
    }
  }, [projectId])

  if (!project && !error.message) {
    return <div className="flex items-center justify-center h-screen bg-bg"><div className="spinner-refined" role="status" aria-label="正在加载项目" /></div>
  }

  if (!project && error.message) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg">
        <div className="bg-danger-muted border border-danger/20 rounded-lg px-6 py-4 max-w-md">
          <h2 className="text-danger text-lg font-semibold mb-2">加载项目失败</h2>
          <p className="text-danger/80 text-sm">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen">
      {error.message && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-danger-muted border border-danger/20 rounded-lg px-4 py-2 text-danger text-sm shadow-lg backdrop-blur-sm" role="alert" aria-live="assertive">
          {error.message}
        </div>
      )}
      <CanvasToolbar
        projectName={projectName}
        onAddNode={handleAddNode}
        onExport={handleExport}
        onProjectNameChange={handleNameChange}
      />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-bg"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="rgba(106,95,193,0.15)" gap={20} />
        <Controls className="!bg-bg-raised !border-border [&>button]:!bg-bg-raised [&>button]:!border-border [&>button]:!text-text-primary [&>button:hover]:!bg-bg-hover" />
        <MiniMap nodeColor="#c2ef4e" maskColor="rgba(31,22,51,0.85)" className="!bg-bg-raised !border-border" />
        <svg>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6a5fc1" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>

      {/* Help button - always visible, re-opens onboarding */}
      <div className="fixed bottom-4 right-4 z-10">
        <button
          onClick={() => setShowOnboarding(true)}
          className="p-2.5 bg-bg-raised border border-border rounded-lg text-text-muted hover:text-text-primary hover:border-border-hover shadow-lg transition-ui backdrop-blur-sm"
          aria-label="查看使用帮助"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      {showOnboarding && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-raised border border-border-strong rounded-xl p-8 w-96 relative shadow-popover">
            <button onClick={() => setShowOnboarding(false)} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary transition-ui" aria-label="关闭引导">
              <X size={18} />
            </button>
            <h2 className="text-xl font-semibold text-text-primary mb-2">开始使用 MindCanvas</h2>
            <p className="text-text-secondary text-sm mb-6">一个可视化的 AI 提示词调试工作区。按以下步骤开始：</p>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-brand-muted rounded-lg text-brand"><MousePointer2 size={18} /></div>
                <div>
                  <p className="text-text-primary text-sm font-medium">新建节点</p>
                  <p className="text-text-muted text-xs">点击上方「新建节点」创建一个 AI 对话卡片</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-accent-muted rounded-lg text-accent"><GitBranchPlus size={18} /></div>
                <div>
                  <p className="text-text-primary text-sm font-medium">连接节点</p>
                  <p className="text-text-muted text-xs">从一个节点的输出拖到另一个节点的输入，建立调试链</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-warning-muted rounded-lg text-warning"><Send size={18} /></div>
                <div>
                  <p className="text-text-primary text-sm font-medium">发送消息</p>
                  <p className="text-text-muted text-xs">在节点底部输入提示词，发送后查看 AI 回复</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FlowCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  )
}
