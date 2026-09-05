import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOrganizationStore } from '../../stores/organization-store.ts'
import { renderWithProviders } from '../../test-utils.tsx'
import { CatalogPage } from './CatalogPage.tsx'

vi.mock('../../features/catalog/api.ts', () => ({
  listCatalogItems: vi.fn(),
  createCatalogItem: vi.fn(),
  updateCatalogItem: vi.fn(),
}))
vi.mock('../../features/organizations/api.ts', () => ({
  listMyOrganizations: vi.fn(),
}))
vi.mock('../../features/tax/api.ts', () => ({
  listTaxRules: vi.fn(),
}))

import { createCatalogItem, listCatalogItems, updateCatalogItem } from '../../features/catalog/api.ts'
import { listMyOrganizations } from '../../features/organizations/api.ts'
import { listTaxRules } from '../../features/tax/api.ts'

const ORG_ID = 'org-1'

const items = [
  {
    id: 'item-1',
    name: 'Consulting Hour',
    description: null,
    type: 'service' as const,
    priceAmount: 15000,
    currencyCode: 'USD',
    sku: null,
    isActive: true,
    taxRuleId: null,
    createdAt: new Date().toISOString(),
  },
]

function mockOrganizations(role: 'owner' | 'admin' | 'member') {
  vi.mocked(listMyOrganizations).mockResolvedValue([
    { id: ORG_ID, name: 'Acme Consulting', countryCode: 'US', baseCurrency: 'USD', role },
  ])
}

describe('CatalogPage', () => {
  beforeEach(() => {
    vi.mocked(listCatalogItems).mockReset()
    vi.mocked(createCatalogItem).mockReset()
    vi.mocked(updateCatalogItem).mockReset()
    vi.mocked(listMyOrganizations).mockReset()
    vi.mocked(listTaxRules).mockReset()
    vi.mocked(listTaxRules).mockResolvedValue([])
    useOrganizationStore.setState({ currentOrganizationId: ORG_ID })
  })

  it('lists items and hides management actions from a member', async () => {
    mockOrganizations('member')
    vi.mocked(listCatalogItems).mockResolvedValue(items)

    renderWithProviders(<CatalogPage />)

    expect(await screen.findByText('Consulting Hour')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New item' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument()
  })

  it('lets an owner create an item', async () => {
    mockOrganizations('owner')
    vi.mocked(listCatalogItems).mockResolvedValue([])
    vi.mocked(createCatalogItem).mockResolvedValue({ ...items[0], id: 'item-2' })

    renderWithProviders(<CatalogPage />)

    await screen.findByRole('button', { name: 'New item' })
    // Wait for the tax-rules query (a second, independent async load
    // gated on the resolved role) to settle before interacting -- doing
    // so mid-flight risks the table re-rendering out from under a
    // just-found element between userEvent's pointer-down and click.
    await waitFor(() => expect(listTaxRules).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'New item' }))
    await userEvent.type(screen.getByLabelText('Name'), 'New Widget')
    await userEvent.type(screen.getByLabelText('Price'), '19.99')

    // See CreateOrganizationPage.test.tsx for why this drives the hidden
    // native <select> rather than the custom popover trigger.
    const [, currencySelect] = document.querySelectorAll('select')
    await userEvent.selectOptions(currencySelect, 'USD')

    await userEvent.click(screen.getByRole('button', { name: 'Create item' }))

    await waitFor(() => expect(createCatalogItem).toHaveBeenCalled())
    expect(vi.mocked(createCatalogItem).mock.calls[0][0]).toMatchObject({
      name: 'New Widget',
      priceAmount: 1999,
      currencyCode: 'USD',
    })
  })

  it('lets an owner deactivate an item', async () => {
    mockOrganizations('owner')
    vi.mocked(listCatalogItems).mockResolvedValue(items)
    vi.mocked(updateCatalogItem).mockResolvedValue({ ...items[0], isActive: false })

    renderWithProviders(<CatalogPage />)

    await screen.findByRole('button', { name: 'Deactivate' })
    await waitFor(() => expect(listTaxRules).toHaveBeenCalled())
    await userEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(updateCatalogItem).toHaveBeenCalledWith('item-1', { isActive: false }))
  })
})
