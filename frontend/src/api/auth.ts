import client from './client'
import type { User } from '../types'

export async function login(username: string, password: string): Promise<{ access_token: string }> {
  const res = await client.post('/auth/login', { username, password })
  return res.data
}

export async function getMe(): Promise<User> {
  const res = await client.get('/auth/me')
  return res.data
}
