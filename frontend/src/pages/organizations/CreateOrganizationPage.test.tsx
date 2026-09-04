import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '../../test-utils.tsx'
import { useOrganizationStore } from '../../stores/organization-store.ts'
import { ApiError } from '../../lib/api.ts'
import { CreateOrganizationPage } from './CreateOrganizationPage.tsx'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../../features/organizations/api.ts', () => ({
  createOrganization: vi.fn(),
}))

import { createOrganization } from '../../features/organizations/api.ts'

// Radix Select renders a visually-hidden native <select> alongside its
// custom popover trigger specifically so forms keep working without the
// popover (autofill, native submission) -- and it's a much more reliable
// way to drive it from jsdom than simulating pointer interaction with a
// portal-rendered popover, which depends on layout/positioning APIs jsdom
// doesn't fully implement.
async function pickCountryAndCurrency(container: HTMLElement) {
  const [countrySelect, currencySelect] = container.querySelectorAll('select')
  await userEvent.selectOptions(countrySelect, 'US')
  await userEvent.selectOptions(currencySelect, 'USD')
}

describe('CreateOrganizationPage', () => {
  beforeEach(() => {
    navigateMock.mockClear()
    vi.mocked(createOrganization).mockReset()
    useOrganizationStore.setState({ currentOrganizationId: null })
  })

  it('shows a validation error for an empty submission', async () => {
    renderWithProviders(<CreateOrganizationPage />)

    await userEvent.click(screen.getByRole('button', { name: /create organization/i }))

    expect(
      await screen.findByText('Organization name is required'),
    ).toBeInTheDocument()
    expect(createOrganization).not.toHaveBeenCalled()
  })

  it('stores the new organization as current and navigates on success', async () => {
    vi.mocked(createOrganization).mockResolvedValue({
      id: 'org-1',
      name: 'Acme Consulting',
      countryCode: 'US',
      baseCurrency: 'USD',
      role: 'owner',
    })

    const { container } = renderWithProviders(<CreateOrganizationPage />)

    await userEvent.type(screen.getByLabelText(/organization name/i), 'Acme Consulting')
    await pickCountryAndCurrency(container)

    await userEvent.click(screen.getByRole('button', { name: /create organization/i }))

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/account'))
    expect(useOrganizationStore.getState().currentOrganizationId).toBe('org-1')
    expect(vi.mocked(createOrganization).mock.calls[0][0]).toEqual({
      name: 'Acme Consulting',
      countryCode: 'US',
      baseCurrency: 'USD',
    })
  })

  it('shows the server error message on failure', async () => {
    vi.mocked(createOrganization).mockRejectedValue(
      new ApiError('Something went wrong', 500),
    )

    const { container } = renderWithProviders(<CreateOrganizationPage />)

    await userEvent.type(screen.getByLabelText(/organization name/i), 'Acme Consulting')
    await pickCountryAndCurrency(container)

    await userEvent.click(screen.getByRole('button', { name: /create organization/i }))

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
  })
})
