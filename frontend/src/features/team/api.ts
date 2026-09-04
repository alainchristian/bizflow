import { apiRequest } from '../../lib/api.ts'

export type MembershipRole = 'owner' | 'admin' | 'member'

export interface TeamMember {
  membershipId: string
  userId: string
  email: string
  fullName: string
  role: MembershipRole
}

export interface Invitation {
  id: string
  organizationId: string
  email: string
  role: MembershipRole
  status: 'pending' | 'accepted' | 'revoked'
  createdAt: string
}

export function listMembers() {
  return apiRequest<TeamMember[]>('/organizations/current/members', {
    auth: true,
    org: true,
  })
}

export function listInvitations() {
  return apiRequest<Invitation[]>('/organizations/current/invitations', {
    auth: true,
    org: true,
  })
}

export function inviteMember(input: { email: string; role: MembershipRole }) {
  return apiRequest<Invitation>('/organizations/current/invitations', {
    method: 'POST',
    body: input,
    auth: true,
    org: true,
  })
}

export function revokeInvitation(id: string) {
  return apiRequest<Invitation>(`/organizations/current/invitations/${id}`, {
    method: 'DELETE',
    auth: true,
    org: true,
  })
}

export function updateMemberRole(membershipId: string, role: MembershipRole) {
  return apiRequest<TeamMember>(`/organizations/current/members/${membershipId}/role`, {
    method: 'PATCH',
    body: { role },
    auth: true,
    org: true,
  })
}

export function removeMember(membershipId: string) {
  return apiRequest<void>(`/organizations/current/members/${membershipId}`, {
    method: 'DELETE',
    auth: true,
    org: true,
  })
}

export function acceptInvitation(id: string) {
  return apiRequest<{ id: string; organizationId: string; role: MembershipRole }>(
    `/invitations/${id}/accept`,
    { method: 'POST', auth: true },
  )
}
