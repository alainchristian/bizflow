import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderWithProviders } from '../test-utils.tsx'
import { useAuthStore } from '../stores/auth-store.ts'
import { RequireAuth } from './RequireAuth.tsx'

function ProtectedPage() {
  return <p>secret account content</p>
}

function LoginStub() {
  return <p>login page</p>
}

function TestRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginStub />} />
      <Route element={<RequireAuth />}>
        <Route path="/account" element={<ProtectedPage />} />
      </Route>
    </Routes>
  )
}

describe('RequireAuth', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
  })

  it('redirects to /login when there is no access token', () => {
    renderWithProviders(<TestRoutes />, { route: '/account' })

    expect(screen.getByText('login page')).toBeInTheDocument()
  })

  it('renders the protected route when an access token is present', () => {
    useAuthStore.setState({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: '1', email: 'jane@example.com', fullName: 'Jane Doe' },
    })

    renderWithProviders(<TestRoutes />, { route: '/account' })

    expect(screen.getByText('secret account content')).toBeInTheDocument()
  })
})
