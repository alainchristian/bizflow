import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrganizationStore } from '../../stores/organization-store.ts'
import { renderWithProviders } from '../../test-utils.tsx'
import { LeadsPage } from './LeadsPage.tsx'

vi.mock('../../features/crm/api.ts', () => ({
  listLeads: vi.fn(),
  createLead: vi.fn(),
  convertLead: vi.fn(),
}))
vi.mock('../../features/organizations/api.ts', () => ({
  listMyOrganizations: vi.fn(),
}))

import { convertLead, createLead, listLeads } from '../../features/crm/api.ts'
import { listMyOrganizations } from '../../features/organizations/api.ts'

const ORG_ID = 'org-1'

const leads = [
  {
    id: 'lead-1',
    fullName: 'Jane Prospect',
    companyName: 'Acme Co',
    email: 'jane@acme.test',
    phone: null,
    source: 'referral',
    status: 'new' as const,
    convertedCustomerId: null,
    createdAt: new Date().toISOString(),
  },
]

function mockOrganizations(role: 'owner' | 'admin' | 'member') {
  vi.mocked(listMyOrganizations).mockResolvedValue([
    { id: ORG_ID, name: 'Acme Consulting', countryCode: 'US', baseCurrency: 'USD', role },
  ])
}

describe('LeadsPage', () => {
  beforeEach(() => {
    vi.mocked(listLeads).mockReset()
    vi.mocked(createLead).mockReset()
    vi.mocked(convertLead).mockReset()
    vi.mocked(listMyOrganizations).mockReset()
    useOrganizationStore.setState({ currentOrganizationId: ORG_ID })
  })

  it('lists leads and hides the Convert action from a member', async () => {
    mockOrganizations('member')
    vi.mocked(listLeads).mockResolvedValue(leads)

    renderWithProviders(<LeadsPage />)

    expect(await screen.findByText('Jane Prospect')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Convert' })).not.toBeInTheDocument()
  })

  it('shows the Convert action to an owner and converts the lead', async () => {
    mockOrganizations('owner')
    vi.mocked(listLeads).mockResolvedValue(leads)
    vi.mocked(convertLead).mockResolvedValue({
      id: 'customer-1',
      name: 'Acme Co',
      email: 'jane@acme.test',
      phone: null,
      convertedFromLeadId: 'lead-1',
      createdAt: new Date().toISOString(),
    })

    renderWithProviders(<LeadsPage />)

    const convertButton = await screen.findByRole('button', { name: 'Convert' })
    await userEvent.click(convertButton)

    await waitFor(() => expect(convertLead).toHaveBeenCalled())
    expect(vi.mocked(convertLead).mock.calls[0][0]).toBe('lead-1')
  })

  it('submits the new-lead form', async () => {
    mockOrganizations('owner')
    vi.mocked(listLeads).mockResolvedValue([])
    vi.mocked(createLead).mockResolvedValue({ ...leads[0], id: 'lead-2' })

    renderWithProviders(<LeadsPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'New lead' }))
    await userEvent.type(screen.getByLabelText('Full name'), 'New Prospect')
    await userEvent.click(screen.getByRole('button', { name: 'Create lead' }))

    await waitFor(() => expect(createLead).toHaveBeenCalled())
    expect(vi.mocked(createLead).mock.calls[0][0]).toMatchObject({ fullName: 'New Prospect' })
  })
})
