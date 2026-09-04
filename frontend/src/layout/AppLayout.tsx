import { Link, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/auth-store.ts'

export function AppLayout() {
  const isAuthenticated = useAuthStore((state) => state.accessToken !== null)

  return (
    <div className="min-h-svh bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-gray-900">
          BizFlow
        </Link>
        <nav className="flex gap-4 text-sm text-gray-700">
          {isAuthenticated ? (
            <Link to="/account">Account</Link>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Sign up</Link>
            </>
          )}
        </nav>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
