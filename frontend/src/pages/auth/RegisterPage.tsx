import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Callout, TextField } from '@radix-ui/themes'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { registerRequest } from '../../features/auth/api.ts'
import { registerSchema, type RegisterValues } from '../../features/auth/schemas.ts'
import { ApiError } from '../../lib/api.ts'
import { useAuthStore } from '../../stores/auth-store.ts'

export function RegisterPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema) })

  const mutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (data) => {
      setAuth(data)
      navigate('/account')
    },
  })

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>

      <form
        className="mt-6 flex flex-col gap-4"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
      >
        {mutation.isError && (
          <Callout.Root color="red">
            <Callout.Text>
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : 'Something went wrong. Please try again.'}
            </Callout.Text>
          </Callout.Root>
        )}

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Full name
          <TextField.Root type="text" {...register('fullName')} />
          {errors.fullName && (
            <span className="text-sm text-red-600">{errors.fullName.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Email
          <TextField.Root type="email" {...register('email')} />
          {errors.email && (
            <span className="text-sm text-red-600">{errors.email.message}</span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Password
          <TextField.Root type="password" {...register('password')} />
          {errors.password && (
            <span className="text-sm text-red-600">{errors.password.message}</span>
          )}
        </label>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Creating account...' : 'Sign up'}
        </Button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  )
}
