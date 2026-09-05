import { apiRequest } from '../../lib/api.ts'

export type CatalogItemType = 'product' | 'service'

export interface CatalogItem {
  id: string
  name: string
  description: string | null
  type: CatalogItemType
  priceAmount: number
  currencyCode: string
  sku: string | null
  isActive: boolean
  taxRuleId: string | null
  createdAt: string
}

export interface CatalogItemInput {
  name: string
  description?: string
  type: CatalogItemType
  priceAmount: number
  currencyCode: string
  sku?: string
  taxRuleId?: string | null
}

export function listCatalogItems() {
  return apiRequest<CatalogItem[]>('/sales/catalog-items', { auth: true, org: true })
}

export function createCatalogItem(input: CatalogItemInput) {
  return apiRequest<CatalogItem>('/sales/catalog-items', {
    method: 'POST',
    body: input,
    auth: true,
    org: true,
  })
}

export function updateCatalogItem(id: string, input: Partial<CatalogItemInput & { isActive: boolean }>) {
  return apiRequest<CatalogItem>(`/sales/catalog-items/${id}`, {
    method: 'PATCH',
    body: input,
    auth: true,
    org: true,
  })
}
