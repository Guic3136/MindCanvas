import type { ComponentType } from 'react'
import type { NodeProps } from '@xyflow/react'
import {
  MessageSquare, FileUp, StickyNote, Globe, TextCursor,
  GitCompare, Code2, ImagePlus,
} from 'lucide-react'
import ChatNode from './ChatNode'
import FileNode from './FileNode'
import NoteNode from './NoteNode'
import WebNode from './WebNode'
import TransformNode from './TransformNode'
import CompareNode from './CompareNode'
import CodeNode from './CodeNode'
import ImageGenNode from './ImageGenNode'

// Placeholder components for future iterations
function PlaceholderNode({ data, selected }: NodeProps) {
  const label = (data as { label?: string }).label || '节点'
  return (
    <div
      className={`bg-bg-raised border rounded-lg shadow-raised flex flex-col items-center justify-center inset-highlight transition-ui ${selected ? 'border-brand glow-brand' : 'border-border'}`}
      style={{ width: 320, height: 200 }}
    >
      <span className="text-text-muted text-sm">{label}</span>
      <span className="text-text-muted text-xs mt-1">(即将上线)</span>
    </div>
  )
}

export interface NodeTypeMeta {
  component: ComponentType<NodeProps>
  label: string
  icon: ComponentType<{ size?: number; className?: string }>
  category: 'input' | 'process' | 'output'
  description: string
}

export const nodeRegistry: Record<string, NodeTypeMeta> = {
  chat: {
    component: ChatNode,
    label: 'AI 对话',
    icon: MessageSquare,
    category: 'input',
    description: '与 AI 模型进行多轮对话',
  },
  file: {
    component: FileNode,
    label: '文件',
    icon: FileUp,
    category: 'input',
    description: '上传图片、PDF、Excel 等文件',
  },
  note: {
    component: NoteNode,
    label: '便签',
    icon: StickyNote,
    category: 'input',
    description: '记录文本笔记，不参与 AI 流程',
  },
  web: {
    component: WebNode,
    label: '网页抓取',
    icon: Globe,
    category: 'input',
    description: '抓取网页内容作为 AI 上下文',
  },
  transform: {
    component: TransformNode,
    label: '文本转换',
    icon: TextCursor,
    category: 'process',
    description: '翻译、格式化、摘要等文本处理',
  },
  compare: {
    component: CompareNode,
    label: '模型对比',
    icon: GitCompare,
    category: 'process',
    description: '并行调用多个模型对比结果',
  },
  code: {
    component: CodeNode,
    label: '代码执行',
    icon: Code2,
    category: 'process',
    description: '运行 Python / JavaScript 代码',
  },
  image_gen: {
    component: ImageGenNode,
    label: '文生图',
    icon: ImagePlus,
    category: 'output',
    description: '根据提示词生成图片',
  },
}

export type NodeType = keyof typeof nodeRegistry

export const reactFlowNodeTypes = Object.fromEntries(
  Object.entries(nodeRegistry).map(([k, v]) => [k, v.component])
)

export const nodeCategories: { key: string; label: string }[] = [
  { key: 'input', label: '输入' },
  { key: 'process', label: '处理' },
  { key: 'output', label: '输出' },
]
