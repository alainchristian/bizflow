import { Button } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { meRequest } from '../features/auth/api.ts'
import { getCurrentOrganization } from '../features/organizations/api.ts'
import { useAuthStore } from '../stores/auth-store.ts'
import { useOrganizationStore } from '../stores/organization-store.ts'

export function AccountPage() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId)
  const clearCurrentOrganizationId = useOrganizationStore(
    (state) => state.clearCurrentOrganizationId,
  )

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: meRequest,
  })

  const { data: organization } = useQuery({
    queryKey: ['organizations', 'current', currentOrganizationId],
    queryFn: getCurrentOrganization,
    enabled: currentOrganizationId !== null,
  })

  function handleLogout() {
    clearAuth()
    clearCurrentOrganizationId()
    navigate('/login')
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Your account</h1>

      {isLoading && <p className="mt-2 text-gray-600">Loading...</p>}
      {isError && (
        <p className="mt-2 text-red-600">Could not load your account details.</p>
      )}
      {user && (
        <div className="mt-2 text-gray-600">
          <p>{user.fullName}</p>
          <p>{user.email}</p>
        </div>
      )}

      <h2 className="mt-6 text-lg font-semibold text-gray-900">Organization</h2>
      {currentOrganizationId === null ? (
        <p className="mt-2 text-gray-600">
          You don't belong to an organization yet.{' '}
          <Link className="text-blue-600" to="/organizations/new">
            Create one
          </Link>
        </p>
      ) : (
        organization && (
          <div className="mt-2 text-gray-600">
            <p>{organization.name}</p>
            <p>
              {organization.countryCode} · {organization.baseCurrency}
            </p>
          </div>
        )
      )}

      <Button className="mt-6" variant="soft" color="gray" onClick={handleLogout}>
        Log out
      </Button>
    </div>
  )
}
