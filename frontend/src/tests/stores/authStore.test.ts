import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../../stores/authStore'
import type { User } from '../../types'

vi.mock('../../api/client', () => ({
  default: { post: vi.fn().mockResolvedValue({}) },
}))

beforeEach(() => {
  useAuthStore.getState().setUser(null)
})

describe('authStore', () => {
  it('initial state has no user', () => {
    const { user } = useAuthStore.getState()
    expect(user).toBeNull()
  })

  it('login action sets user state correctly', () => {
    const user: User = { id: 1, username: 'test', is_admin: false }
    useAuthStore.getState().setUser(user)
    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('logout action clears user state', async () => {
    const user: User = { id: 1, username: 'test', is_admin: false }
    useAuthStore.getState().setUser(user)
    await useAuthStore.getState().logout()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
