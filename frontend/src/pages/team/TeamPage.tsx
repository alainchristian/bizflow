import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Callout, Select, Table, TextField } from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  inviteMember,
  listInvitations,
  listMembers,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type MembershipRole,
} from '../../features/team/api.ts'
import { canManageRoles, canManageTeam, inviteMemberSchema, type InviteMemberValues } from '../../features/team/schemas.ts'
import { listMyOrganizations } from '../../features/organizations/api.ts'
import { ApiError } from '../../lib/api.ts'
import { useAuthStore } from '../../stores/auth-store.ts'
import { useOrganizationStore } from '../../stores/organization-store.ts'

export function TeamPage() {
  const queryClient = useQueryClient()
  const currentOrganizationId = useOrganizationStore((state) => state.currentOrganizationId)
  const currentUserId = useAuthStore((state) => state.user?.id)

  const { data: organizations } = useQuery({
    queryKey: ['organizations'],
    queryFn: listMyOrganizations,
  })
  const myRole = organizations?.find((org) => org.id === currentOrganizationId)?.role

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['team', 'members', currentOrganizationId],
    queryFn: listMembers,
    enabled: currentOrganizationId !== null,
  })

  const { data: invitations } = useQuery({
    queryKey: ['team', 'invitations', currentOrganizationId],
    queryFn: listInvitations,
    enabled: currentOrganizationId !== null && canManageTeam(myRole),
  })

  const invalidateTeam = () =>
    queryClient.invalidateQueries({ queryKey: ['team'] })

  const inviteMutation = useMutation({
    mutationFn: inviteMember,
    onSuccess: invalidateTeam,
  })
  const revokeMutation = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: invalidateTeam,
  })
  const roleMutation = useMutation({
    mutationFn: ({ membershipId, role }: { membershipId: string; role: MembershipRole }) =>
      updateMemberRole(membershipId, role),
    onSuccess: invalidateTeam,
  })
  const removeMutation = useMutation({
    mutationFn: removeMember,
    onSuccess: invalidateTeam,
  })

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '', role: 'member' },
  })

  if (currentOrganizationId === null) {
    return <p className="text-gray-600">Create or select an organization first.</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Team</h1>

      <h2 className="mt-6 text-lg font-semibold text-gray-900">Members</h2>
      {membersLoading && <p className="mt-2 text-gray-600">Loading...</p>}
      {members && (
        <Table.Root className="mt-2">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Name</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Email</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Role</Table.ColumnHeaderCell>
              {canManageTeam(myRole) && <Table.ColumnHeaderCell />}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {members.map((member) => (
              <Table.Row key={member.membershipId}>
                <Table.Cell>{member.fullName}</Table.Cell>
                <Table.Cell>{member.email}</Table.Cell>
                <Table.Cell>
                  {canManageRoles(myRole) ? (
                    <Select.Root
                      value={member.role}
                      onValueChange={(role) =>
                        roleMutation.mutate({ membershipId: member.membershipId, role: role as MembershipRole })
                      }
                    >
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Item value="owner">Owner</Select.Item>
                        <Select.Item value="admin">Admin</Select.Item>
                        <Select.Item value="member">Member</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  ) : (
                    member.role
                  )}
                </Table.Cell>
                {canManageTeam(myRole) && (
                  <Table.Cell>
                    {member.userId !== currentUserId && (
                      <Button
                        variant="soft"
                        color="red"
                        size="1"
                        onClick={() => removeMutation.mutate(member.membershipId)}
                      >
                        Remove
                      </Button>
                    )}
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
      {(roleMutation.isError || removeMutation.isError) && (
        <Callout.Root color="red" className="mt-2">
          <Callout.Text>
            {[roleMutation.error, removeMutation.error]
              .filter((error): error is ApiError => error instanceof ApiError)
              .map((error) => error.message)
              .join(' ')}
          </Callout.Text>
        </Callout.Root>
      )}

      {canManageTeam(myRole) && (
        <>
          <h2 className="mt-8 text-lg font-semibold text-gray-900">Pending invitations</h2>
          {invitations && invitations.length === 0 && (
            <p className="mt-2 text-gray-600">No pending invitations.</p>
          )}
          {invitations && invitations.length > 0 && (
            <ul className="mt-2 flex flex-col gap-2">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 text-gray-600">
                  <span>
                    {invitation.email} ({invitation.role})
                  </span>
                  <Button
                    variant="soft"
                    color="gray"
                    size="1"
                    onClick={() => revokeMutation.mutate(invitation.id)}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-8 text-lg font-semibold text-gray-900">Invite a teammate</h2>
          <form
            className="mt-2 flex max-w-sm flex-col gap-4"
            onSubmit={handleSubmit((values) => {
              inviteMutation.mutate(values, { onSuccess: () => reset() })
            })}
          >
            {inviteMutation.isError && (
              <Callout.Root color="red">
                <Callout.Text>
                  {inviteMutation.error instanceof ApiError
                    ? inviteMutation.error.message
                    : 'Something went wrong. Please try again.'}
                </Callout.Text>
              </Callout.Root>
            )}
            {inviteMutation.isSuccess && (
              <Callout.Root color="green">
                <Callout.Text>Invitation sent.</Callout.Text>
              </Callout.Root>
            )}

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Email
              <TextField.Root type="email" {...register('email')} />
              {errors.email && (
                <span className="text-sm text-red-600">{errors.email.message}</span>
              )}
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Role
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select.Root value={field.value} onValueChange={field.onChange}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="admin">Admin</Select.Item>
                      <Select.Item value="member">Member</Select.Item>
                    </Select.Content>
                  </Select.Root>
                )}
              />
              {errors.role && (
                <span className="text-sm text-red-600">{errors.role.message}</span>
              )}
            </label>

            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : 'Send invitation'}
            </Button>
          </form>
        </>
      )}
    </div>
  )
}
