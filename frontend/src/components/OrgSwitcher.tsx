import { Select } from '@radix-ui/themes'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listMyOrganizations } from '../features/organizations/api.ts'
import { useOrganizationStore } from '../stores/organization-store.ts'

/**
 * Shows the user's organizations and lets them pick which one subsequent
 * requests operate in (sent as X-Organization-Id, see lib/api.ts). Works
 * the same whether the user has one organization or several -- today
 * that's almost always "one", but the switching behavior is exercised
 * from day one rather than bolted on later.
 */
export function OrgSwitcher() {
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId)
  const setCurrentOrganizationId = useOrganizationStore(
    (state) => state.setCurrentOrganizationId,
  )

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: listMyOrganizations,
  })

  useEffect(() => {
    if (!organizations || organizations.length === 0) return
    const stillValid = organizations.some((org) => org.id === currentOrganizationId)
    if (!stillValid) {
      setCurrentOrganizationId(organizations[0].id)
    }
  }, [organizations, currentOrganizationId, setCurrentOrganizationId])

  if (!organizations) return null

  if (organizations.length === 0) {
    return (
      <Link to="/organizations/new" className="text-sm text-blue-600">
        Create an organization
      </Link>
    )
  }

  return (
    <Select.Root value={currentOrganizationId ?? undefined} onValueChange={setCurrentOrganizationId}>
      <Select.Trigger />
      <Select.Content>
        {organizations.map((org) => (
          <Select.Item key={org.id} value={org.id}>
            {org.name}
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  )
}
