import { apiRequest } from '../../lib/api.ts'

export interface OrganizationSummary {
  id: string
  name: string
  countryCode: string
  baseCurrency: string
  role: 'owner' | 'admin' | 'member'
}

export interface OrganizationSettings {
  id: string
  organizationId: string
  dateFormat: string
  invoiceNumberPrefix: string
  invoiceNumberNext: number
  taxInclusivePricing: boolean
  logoUrl: string | null
}

export interface CurrentOrganization {
  id: string
  name: string
  countryCode: string
  baseCurrency: string
  timezone: string
  industry: string | null
  settings: OrganizationSettings
}

export function createOrganization(input: {
  name: string
  countryCode: string
  baseCurrency: string
}) {
  return apiRequest<OrganizationSummary>('/organizations', {
    method: 'POST',
    body: input,
    auth: true,
  })
}

export function listMyOrganizations() {
  return apiRequest<OrganizationSummary[]>('/organizations', { auth: true })
}

export function getCurrentOrganization() {
  return apiRequest<CurrentOrganization>('/organizations/current', {
    auth: true,
    org: true,
  })
}
