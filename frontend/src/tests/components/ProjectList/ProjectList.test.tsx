import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProjectList from '../../../components/ProjectList/ProjectList'
import * as projectApi from '../../../api/project'
import { useAuthStore } from '../../../stores/authStore'

vi.mock('../../../api/project', () => ({
  listProjects: vi.fn(),
  createProject: vi.fn(),
  deleteProject: vi.fn(),
}))

beforeEach(() => {
  useAuthStore.getState().setUser(null)
  vi.clearAllMocks()
})

const renderWithRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('ProjectList', () => {
  it('shows "No projects" when empty', async () => {
    vi.mocked(projectApi.listProjects).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 10 })
    renderWithRouter(<ProjectList />)
    expect(await screen.findByText(/还没有项目/)).toBeInTheDocument()
  })

  it('shows create modal when button is clicked', async () => {
    vi.mocked(projectApi.listProjects).mockResolvedValue({ items: [], total: 0, skip: 0, limit: 10 })
    renderWithRouter(<ProjectList />)
    await screen.findByText(/还没有项目/)
    const createBtn = screen.getByRole('button', { name: /新建项目/ })
    fireEvent.click(createBtn)
    expect(await screen.findByRole('heading', { name: '新建项目' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('项目名称')).toBeInTheDocument()
  })

  it('shows delete confirmation modal', async () => {
    vi.mocked(projectApi.listProjects).mockResolvedValue({ items: [
      { id: 1, name: 'My Project', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z' },
    ], total: 1, skip: 0, limit: 10 })
    renderWithRouter(<ProjectList />)
    const projectCard = await screen.findByText('My Project')
    const container = projectCard.closest('div.flex') as HTMLElement
    const deleteBtn = within(container).getByRole('button')
    fireEvent.click(deleteBtn)
    expect(await screen.findByText('确认删除')).toBeInTheDocument()
    expect(screen.getByText(/确定删除此项目/)).toBeInTheDocument()
  })
})
