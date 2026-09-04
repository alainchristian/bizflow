import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test-utils.tsx'
import { useAuthStore } from '../../stores/auth-store.ts'
import { ApiError } from '../../lib/api.ts'
import { RegisterPage } from './RegisterPage.tsx'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../features/auth/api.ts', () => ({
  registerRequest: vi.fn(),
}))

import { registerRequest } from '../../features/auth/api.ts'

describe('RegisterPage', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    vi.mocked(registerRequest).mockReset()
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
  })

  it('shows a validation error for a short password', async () => {
    renderWithProviders(<RegisterPage />)

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'short')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(
      await screen.findByText('Password must be at least 8 characters'),
    ).toBeInTheDocument()
    expect(registerRequest).not.toHaveBeenCalled()
  })

  it('stores auth state and navigates on success', async () => {
    vi.mocked(registerRequest).mockResolvedValue({
      user: { id: '1', email: 'jane@example.com', fullName: 'Jane Doe' },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    renderWithProviders(<RegisterPage />)

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'super-secret-1')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/account'))
    expect(useAuthStore.getState().user).toMatchObject({ email: 'jane@example.com' })
  })

  it('shows the server error message on a duplicate email', async () => {
    vi.mocked(registerRequest).mockRejectedValue(
      new ApiError('An account with this email already exists', 409),
    )

    renderWithProviders(<RegisterPage />)

    await userEvent.type(screen.getByLabelText(/full name/i), 'Jane Doe')
    await userEvent.type(screen.getByLabelText(/email/i), 'jane@example.com')
    await userEvent.type(screen.getByLabelText(/password/i), 'super-secret-1')
    await userEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument()
  })
})
