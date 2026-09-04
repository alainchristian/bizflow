import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test-utils.tsx'
import { useAuthStore } from '../../stores/auth-store.ts'
import { ApiError } from '../../lib/api.ts'
import { LoginPage } from './LoginPage.tsx'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../features/auth/api.ts', () => ({
  loginRequest: vi.fn(),
}))

import { loginRequest } from '../../features/auth/api.ts'

describe('LoginPage', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    vi.mocked(loginRequest).mockReset()
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
  })

  it('shows validation errors for an empty submission', async () => {
    renderWithProviders(<LoginPage />)

    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(loginRequest).not.toHaveBeenCalled()
  })

  it('stores auth state and navigates on success', async () => {
    vi.mocked(loginRequest).mockResolvedValue({
      user: { id: '1', email: 'jane@example.com', fullName: 'Jane Doe' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    renderWithProviders(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'super-secret-1')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/account'))
    expect(useAuthStore.getState().accessToken).toBe('access-token')
  })

  it('shows the server error message on failed login', async () => {
    vi.mocked(loginRequest).mockRejectedValue(
      new ApiError('Invalid email or password', 401),
    )

    renderWithProviders(<LoginPage />)

    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
  })
})
