import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useParams } from 'react-router-dom'
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
  const { project, models, loadProject, loadModels, addNode, updateNodePosition, addEdge: addDbEdge, updateEdgeMode, removeEdge: removeDbEdge } = useCanvasStore()

  const [projectName, setProjectName] = useState('')

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

  // Sync when project changes
  useEffect(() => { setNodes(rfNodes) }, [rfNodes, setNodes])
  useEffect(() => { setEdges(rfEdges) }, [rfEdges, setEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    addDbEdge(Number(connection.source), Number(connection.target))
  }, [addDbEdge])

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    updateNodePosition(Number(node.id), node.position)
  }, [updateNodePosition])

  const handleAddNode = useCallback(() => {
    if (models.length === 0) {
      alert('请先在管理员页面添加模型')
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

  if (!project) {
    return <div className="flex items-center justify-center h-screen bg-gray-950 text-white">加载中...</div>
  }

  return (
    <div className="h-screen w-screen">
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
        className="bg-gray-950"
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#374151" gap={20} />
        <Controls className="!bg-gray-800 !border-gray-700 [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-white [&>button:hover]:!bg-gray-700" />
        <MiniMap nodeColor="#3b82f6" maskColor="rgba(0,0,0,0.8)" className="!bg-gray-900 !border-gray-700" />
        <svg>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
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
