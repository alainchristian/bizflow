import { Button } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { meRequest } from '../features/auth/api.ts'
import { useAuthStore } from '../stores/auth-store.ts'

export function AccountPage() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: meRequest,
  })

  function handleLogout() {
    clearAuth()
    navigate('/login')
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Your account</h1>

      {isLoading && <p className="mt-2 text-gray-600">Loading...</p>}
      {isError && (
        <p className="mt-2 text-red-600">Could not load your account details.</p>
      )}
      {data && (
        <div className="mt-2 text-gray-600">
          <p>{data.fullName}</p>
          <p>{data.email}</p>
        </div>
      )}

      <Button className="mt-6" variant="soft" color="gray" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  )
}
