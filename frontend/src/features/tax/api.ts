import { apiRequest } from '../../lib/api.ts'

export interface TaxRule {
  id: string
  name: string
  rateBasisPoints: number
  isInclusive: boolean
  isActive: boolean
  createdAt: string
}

export interface TaxRuleInput {
  name: string
  rateBasisPoints: number
  isInclusive?: boolean
}

export function listTaxRules() {
  return apiRequest<TaxRule[]>('/sales/tax-rules', { auth: true, org: true })
}

export function createTaxRule(input: TaxRuleInput) {
  return apiRequest<TaxRule>('/sales/tax-rules', {
    method: 'POST',
    body: input,
    auth: true,
    org: true,
  })
}

export function updateTaxRule(id: string, input: Partial<TaxRuleInput & { isActive: boolean }>) {
  return apiRequest<TaxRule>(`/sales/tax-rules/${id}`, {
    method: 'PATCH',
    body: input,
    auth: true,
    org: true,
  })
}
