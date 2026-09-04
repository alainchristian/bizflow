import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Callout, TextField } from '@radix-ui/themes'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { loginRequest } from '../../features/auth/api.ts'
import { loginSchema, type LoginValues } from '../../features/auth/schemas.ts'
import { ApiError } from '../../lib/api.ts'
import { useAuthStore } from '../../stores/auth-store.ts'

export function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((state) => state.setAuth)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  const mutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (data) => {
      setAuth(data)
      navigate('/account')
    },
  })

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-2xl font-semibold text-gray-900">Log in</h1>

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
          {mutation.isPending ? 'Logging in...' : 'Log in'}
        </Button>
      </form>

      <p className="mt-4 text-sm text-gray-600">
        Don't have an account? <Link to="/register">Sign up</Link>
      </p>
    </div>
  )
}
