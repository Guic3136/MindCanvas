export interface User {
  id: number
  username: string
  is_admin: boolean
}

export interface ModelProvider {
  id: number
  name: string
  base_url: string
  api_key_masked: string
  created_at: string
}

export interface ModelInfo {
  id: number
  provider_id: number
  model_id: string
  display_name: string
  is_enabled: boolean
}

export interface Project {
  id: number
  name: string
  owner_id: number
  created_at: string
  updated_at: string
  nodes: NodeInfo[]
  edges: EdgeInfo[]
}

export interface ProjectListItem {
  id: number
  name: string
  created_at: string
  updated_at: string
}

export interface NodeInfo {
  id: number
  model_id: number
  label: string
  position_x: number
  position_y: number
  width: number
  height: number
}

export interface EdgeInfo {
  id: number
  source_node_id: number
  target_node_id: number
  context_mode: string
}

export interface Message {
  id: number
  node_id: number
  role: 'user' | 'assistant'
  content: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}
