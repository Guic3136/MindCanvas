import client from './client'
import type { ModelProvider, ModelInfo, PaginatedResponse } from '../types'

export async function listProviders(): Promise<PaginatedResponse<ModelProvider>> {
  const { data } = await client.get<PaginatedResponse<ModelProvider>>('/admin/providers')
  return data
}

export async function createProvider(data: { name: string; base_url: string; api_key: string }): Promise<ModelProvider> {
  const { data: result } = await client.post<ModelProvider>('/admin/providers', data)
  return result
}

export async function updateProvider(id: number, data: { name?: string; base_url?: string; api_key?: string }): Promise<ModelProvider> {
  const { data: result } = await client.put<ModelProvider>(`/admin/providers/${id}`, data)
  return result
}

export async function deleteProvider(id: number): Promise<void> {
  await client.delete(`/admin/providers/${id}`)
}

export async function listModels(): Promise<PaginatedResponse<ModelInfo>> {
  const { data } = await client.get<PaginatedResponse<ModelInfo>>('/admin/models')
  return data
}

export async function createModel(data: { provider_id: number; model_id: string; display_name: string }): Promise<ModelInfo> {
  const { data: result } = await client.post<ModelInfo>('/admin/models', data)
  return result
}

export async function updateModel(id: number, data: { is_enabled?: boolean; display_name?: string; model_id?: string; supports_vision?: boolean }): Promise<ModelInfo> {
  const { data: result } = await client.put<ModelInfo>(`/admin/models/${id}`, data)
  return result
}

export async function deleteModel(id: number): Promise<void> {
  await client.delete(`/admin/models/${id}`)
}

interface UserListItem {
  id: number
  username: string
  is_admin: boolean
  created_at: string
}

export async function listUsers(): Promise<PaginatedResponse<UserListItem>> {
  const { data } = await client.get<PaginatedResponse<UserListItem>>('/admin/users')
  return data
}

export async function createUser(data: { username: string; password: string }): Promise<UserListItem> {
  const { data: result } = await client.post<UserListItem>('/admin/users', data)
  return result
}

export async function deleteUser(id: number): Promise<void> {
  await client.delete(`/admin/users/${id}`)
}

export interface ImageGenConfig {
  id: number
  name: string
  base_url: string
  model_id: string
  api_key_masked: string
  created_at: string
  updated_at: string
}

export async function getImageGenConfig(): Promise<ImageGenConfig> {
  const { data } = await client.get<ImageGenConfig>('/admin/image-gen-config')
  return data
}

export async function updateImageGenConfig(data: { name?: string; base_url?: string; model_id?: string; api_key?: string }): Promise<ImageGenConfig> {
  const { data: result } = await client.put<ImageGenConfig>('/admin/image-gen-config', data)
  return result
}
