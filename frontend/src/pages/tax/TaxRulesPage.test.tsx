import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrganizationStore } from '../../stores/organization-store.ts'
import { renderWithProviders } from '../../test-utils.tsx'
import { TaxRulesPage } from './TaxRulesPage.tsx'

vi.mock('../../features/tax/api.ts', () => ({
  listTaxRules: vi.fn(),
  createTaxRule: vi.fn(),
  updateTaxRule: vi.fn(),
}))
vi.mock('../../features/organizations/api.ts', () => ({
  listMyOrganizations: vi.fn(),
}))

import { createTaxRule, listTaxRules, updateTaxRule } from '../../features/tax/api.ts'
import { listMyOrganizations } from '../../features/organizations/api.ts'

const ORG_ID = 'org-1'

const rules = [
  {
    id: 'rule-1',
    name: 'Sales Tax',
    rateBasisPoints: 1000,
    isInclusive: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
]

function mockOrganizations(role: 'owner' | 'admin' | 'member') {
  vi.mocked(listMyOrganizations).mockResolvedValue([
    { id: ORG_ID, name: 'Acme Consulting', countryCode: 'US', baseCurrency: 'USD', role },
  ])
}

describe('TaxRulesPage', () => {
  beforeEach(() => {
    vi.mocked(listTaxRules).mockReset()
    vi.mocked(createTaxRule).mockReset()
    vi.mocked(updateTaxRule).mockReset()
    vi.mocked(listMyOrganizations).mockReset()
    useOrganizationStore.setState({ currentOrganizationId: ORG_ID })
  })

  it('tells a member they do not have access, without calling the API', async () => {
    mockOrganizations('member')

    renderWithProviders(<TaxRulesPage />)

    expect(await screen.findByText("You don't have access to tax settings.")).toBeInTheDocument()
    expect(listTaxRules).not.toHaveBeenCalled()
  })

  it('lists tax rules for an owner', async () => {
    mockOrganizations('owner')
    vi.mocked(listTaxRules).mockResolvedValue(rules)

    renderWithProviders(<TaxRulesPage />)

    expect(await screen.findByText('Sales Tax')).toBeInTheDocument()
    expect(screen.getByText('10.00%')).toBeInTheDocument()
    expect(screen.getByText('Exclusive')).toBeInTheDocument()
  })

  it('lets an owner create a tax rule', async () => {
    mockOrganizations('owner')
    vi.mocked(listTaxRules).mockResolvedValue([])
    vi.mocked(createTaxRule).mockResolvedValue({ ...rules[0], id: 'rule-2' })

    renderWithProviders(<TaxRulesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'New tax rule' }))
    await userEvent.type(screen.getByLabelText('Name'), 'VAT')
    await userEvent.type(screen.getByLabelText('Rate (%)'), '20')
    await userEvent.click(screen.getByRole('button', { name: 'Create tax rule' }))

    await waitFor(() => expect(createTaxRule).toHaveBeenCalled())
    expect(vi.mocked(createTaxRule).mock.calls[0][0]).toMatchObject({
      name: 'VAT',
      rateBasisPoints: 2000,
      isInclusive: false,
    })
  })

  it('lets an owner deactivate a tax rule', async () => {
    mockOrganizations('owner')
    vi.mocked(listTaxRules).mockResolvedValue(rules)
    vi.mocked(updateTaxRule).mockResolvedValue({ ...rules[0], isActive: false })

    renderWithProviders(<TaxRulesPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(updateTaxRule).toHaveBeenCalledWith('rule-1', { isActive: false }))
  })
})
