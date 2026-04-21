import client from './client'
import type { Project, ProjectListItem } from '../types'

export async function listProjects(): Promise<ProjectListItem[]> {
  const { data } = await client.get<ProjectListItem[]>('/projects')
  return data
}

export async function createProject(name: string): Promise<Project> {
  const { data } = await client.post<Project>('/projects', { name })
  return data
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await client.get<Project>(`/projects/${id}`)
  return data
}

export async function updateProject(id: number, name: string): Promise<Project> {
  const { data } = await client.put<Project>(`/projects/${id}`, { name })
  return data
}

export async function deleteProject(id: number): Promise<void> {
  await client.delete(`/projects/${id}`)
}
