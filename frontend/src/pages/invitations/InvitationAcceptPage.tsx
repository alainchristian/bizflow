import { Button, Callout } from '@radix-ui/themes'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { acceptInvitation } from '../../features/team/api.ts'
import { ApiError } from '../../lib/api.ts'
import { useAuthStore } from '../../stores/auth-store.ts'
import { useOrganizationStore } from '../../stores/organization-store.ts'

export function InvitationAcceptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((state) => state.accessToken !== null)
  const setCurrentOrganizationId = useOrganizationStore(
    (state) => state.setCurrentOrganizationId,
  )

  const mutation = useMutation({
    mutationFn: () => acceptInvitation(id!),
    onSuccess: async (membership) => {
      setCurrentOrganizationId(membership.organizationId)
      await queryClient.invalidateQueries({ queryKey: ['organizations'] })
      navigate('/account')
    },
  })

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-semibold text-gray-900">You've been invited</h1>
        <p className="mt-2 text-gray-600">
          Log in or create an account to accept this invitation.
        </p>
        <div className="mt-4 flex gap-4">
          <Link className="text-blue-600" to="/login">
            Log in
          </Link>
          <Link className="text-blue-600" to="/register">
            Sign up
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-gray-900">You've been invited</h1>

      {mutation.isError && (
        <Callout.Root color="red" className="mt-4">
          <Callout.Text>
            {mutation.error instanceof ApiError
              ? mutation.error.message
              : 'Something went wrong. Please try again.'}
          </Callout.Text>
        </Callout.Root>
      )}

      <Button className="mt-4" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Accepting...' : 'Accept invitation'}
      </Button>
    </div>
  )
}
