import client from './client'
import type { NodeInfo, EdgeInfo, Message } from '../types'

export async function createNode(
  projectId: number,
  data: { model_id: number; label?: string; position_x?: number; position_y?: number }
): Promise<NodeInfo> {
  const { data: result } = await client.post<NodeInfo>(`/projects/${projectId}/nodes`, data)
  return result
}

export async function updateNode(
  projectId: number,
  nodeId: number,
  data: Partial<NodeInfo>
): Promise<NodeInfo> {
  const { data: result } = await client.put<NodeInfo>(`/projects/${projectId}/nodes/${nodeId}`, data)
  return result
}

export async function deleteNode(projectId: number, nodeId: number): Promise<void> {
  await client.delete(`/projects/${projectId}/nodes/${nodeId}`)
}

export async function getMessages(projectId: number, nodeId: number): Promise<Message[]> {
  const { data } = await client.get<Message[]>(`/projects/${projectId}/nodes/${nodeId}/messages`)
  return data
}

export async function createEdge(
  projectId: number,
  data: { source_node_id: number; target_node_id: number; context_mode?: string }
): Promise<EdgeInfo> {
  const { data: result } = await client.post<EdgeInfo>(`/projects/${projectId}/edges`, data)
  return result
}

export async function updateEdge(
  projectId: number,
  edgeId: number,
  data: { context_mode: string }
): Promise<EdgeInfo> {
  const { data: result } = await client.put<EdgeInfo>(`/projects/${projectId}/edges/${edgeId}`, data)
  return result
}

export async function deleteEdge(projectId: number, edgeId: number): Promise<void> {
  await client.delete(`/projects/${projectId}/edges/${edgeId}`)
}

export function chatStream(
  projectId: number,
  nodeId: number,
  message: string,
  onToken: (token: string) => void,
  onDone: (messageId: number) => void,
  onError: (error: string) => void
) {
  const controller = new AbortController()

  fetch(`/api/projects/${projectId}/nodes/${nodeId}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
    credentials: 'include',
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text()
        onError(text)
        return
      }
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'token') onToken(data.content)
              if (data.type === 'done') onDone(data.message_id)
              if (data.type === 'error') onError(data.error)
            } catch {}
          }
        }
      }
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        const msg = err.message === 'Failed to fetch'
          ? '无法连接到服务器，请检查后端服务是否运行'
          : err.message
        onError(msg)
      }
    })

  return { cancel: () => controller.abort() }
}
