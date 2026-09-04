import { apiRequest } from '../../lib/api.ts'
import type { AuthUser } from '../../stores/auth-store.ts'

export interface AuthResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export function registerRequest(input: {
  email: string
  password: string
  fullName: string
}) {
  return apiRequest<AuthResponse>('/auth/register', { method: 'POST', body: input })
}

export function loginRequest(input: { email: string; password: string }) {
  return apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input })
}

export function meRequest() {
  return apiRequest<AuthUser>('/auth/me', { auth: true })
}
