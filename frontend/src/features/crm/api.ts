import { apiRequest } from '../../lib/api.ts'

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'

export interface Lead {
  id: string
  fullName: string
  companyName: string | null
  email: string | null
  phone: string | null
  source: string | null
  status: LeadStatus
  convertedCustomerId: string | null
  createdAt: string
}

export interface Customer {
  id: string
  name: string
  email: string | null
  phone: string | null
  convertedFromLeadId: string | null
  createdAt: string
}

export interface Contact {
  id: string
  fullName: string
  email: string | null
  phone: string | null
}

export interface CustomerNote {
  id: string
  authorUserId: string
  body: string
  createdAt: string
}

export interface CustomerDetail extends Customer {
  contacts: Contact[]
  notes: CustomerNote[]
}

export function listLeads() {
  return apiRequest<Lead[]>('/crm/leads', { auth: true, org: true })
}

export function createLead(input: {
  fullName: string
  companyName?: string
  email?: string
  phone?: string
  source?: string
}) {
  return apiRequest<Lead>('/crm/leads', { method: 'POST', body: input, auth: true, org: true })
}

export function convertLead(id: string) {
  return apiRequest<Customer>(`/crm/leads/${id}/convert`, {
    method: 'POST',
    auth: true,
    org: true,
  })
}

export function listCustomers() {
  return apiRequest<Customer[]>('/crm/customers', { auth: true, org: true })
}

export function getCustomer(id: string) {
  return apiRequest<CustomerDetail>(`/crm/customers/${id}`, { auth: true, org: true })
}

export function addCustomerNote(customerId: string, body: string) {
  return apiRequest<CustomerNote>(`/crm/customers/${customerId}/notes`, {
    method: 'POST',
    body: { body },
    auth: true,
    org: true,
  })
}

export function addCustomerContact(
  customerId: string,
  input: { fullName: string; email?: string; phone?: string },
) {
  return apiRequest<Contact>(`/crm/customers/${customerId}/contacts`, {
    method: 'POST',
    body: input,
    auth: true,
    org: true,
  })
}
