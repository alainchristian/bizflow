import { useAuthStore } from '../stores/auth-store.ts'
import { useOrganizationStore } from '../stores/organization-store.ts'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH'
  body?: unknown
  auth?: boolean
  /** Attach the currently selected organization as X-Organization-Id. */
  org?: boolean
}

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body, auth = false, org = false }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (auth) {
    const token = useAuthStore.getState().accessToken
    if (token) headers.Authorization = `Bearer ${token}`
  }

  if (org) {
    const organizationId = useOrganizationStore.getState().currentOrganizationId
    if (organizationId) headers['X-Organization-Id'] = organizationId
  }

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(payload?.message ?? response.statusText, response.status)
  }

  return response.json() as Promise<T>
}
