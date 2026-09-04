import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../test-utils.tsx'
import { useOrganizationStore } from '../stores/organization-store.ts'
import { OrgSwitcher } from './OrgSwitcher.tsx'

vi.mock('../features/organizations/api.ts', () => ({
  listMyOrganizations: vi.fn(),
}))

import { listMyOrganizations } from '../features/organizations/api.ts'

describe('OrgSwitcher', () => {
  beforeEach(() => {
    vi.mocked(listMyOrganizations).mockReset()
    useOrganizationStore.setState({ currentOrganizationId: null })
  })

  it('offers to create an organization when the user has none', async () => {
    vi.mocked(listMyOrganizations).mockResolvedValue([])

    renderWithProviders(<OrgSwitcher />)

    expect(await screen.findByText('Create an organization')).toBeInTheDocument()
  })

  it('auto-selects the only organization the user belongs to', async () => {
    vi.mocked(listMyOrganizations).mockResolvedValue([
      { id: 'org-1', name: 'Acme Consulting', countryCode: 'US', baseCurrency: 'USD', role: 'owner' },
    ])

    renderWithProviders(<OrgSwitcher />)

    await waitFor(() =>
      expect(useOrganizationStore.getState().currentOrganizationId).toBe('org-1'),
    )
    expect(await screen.findByText('Acme Consulting')).toBeInTheDocument()
  })

  it('falls back to the first organization if the stored one no longer matches', async () => {
    useOrganizationStore.setState({ currentOrganizationId: 'stale-org' })
    vi.mocked(listMyOrganizations).mockResolvedValue([
      { id: 'org-1', name: 'Acme Consulting', countryCode: 'US', baseCurrency: 'USD', role: 'owner' },
    ])

    renderWithProviders(<OrgSwitcher />)

    await waitFor(() =>
      expect(useOrganizationStore.getState().currentOrganizationId).toBe('org-1'),
    )
  })
})
