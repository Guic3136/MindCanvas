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
  supports_vision?: boolean
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
  node_type: string
  label: string
  position_x: number
  position_y: number
  width: number
  height: number
  // file
  file_url?: string
  file_name?: string
  file_type?: string
  // web
  web_url?: string
  web_content?: string
  // note
  note_content?: string
  // transform
  transform_prompt?: string
  transform_output?: string
  transform_format?: string
  merge_strategy?: string
  self_critique?: boolean
  max_iterations?: number
  // compare
  compare_model_ids?: string
  // code
  code_language?: string
  code_script?: string
  code_output?: string
  // image_gen
  image_gen_prompt?: string
  image_gen_url?: string
  // transform extensions
  batch_mode?: boolean
  routing_rules?: string
  transform_route?: string
}

export interface EdgeInfo {
  id: number
  source_node_id: number
  target_node_id: number
  context_mode: string
  route_tag?: string
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
