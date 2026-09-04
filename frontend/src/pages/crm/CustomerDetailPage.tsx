import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Callout, TextField } from '@radix-ui/themes'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import {
  addCustomerContact,
  addCustomerNote,
  getCustomer,
} from '../../features/crm/api.ts'
import { z } from 'zod'
import { addContactSchema, type AddContactValues } from '../../features/crm/schemas.ts'
import { ApiError } from '../../lib/api.ts'

const addNoteSchema = z.object({
  body: z.string().min(1, 'Note cannot be empty'),
})
type AddNoteValues = z.infer<typeof addNoteSchema>

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: customer, isLoading } = useQuery({
    queryKey: ['crm', 'customers', 'detail', id],
    queryFn: () => getCustomer(id!),
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['crm', 'customers', 'detail', id] })

  const noteMutation = useMutation({
    mutationFn: (body: string) => addCustomerNote(id!, body),
    onSuccess: () => {
      invalidate()
      resetNote()
    },
  })
  const contactMutation = useMutation({
    mutationFn: (input: AddContactValues) => addCustomerContact(id!, input),
    onSuccess: () => {
      invalidate()
      resetContact()
    },
  })

  const {
    register: registerNote,
    handleSubmit: handleNoteSubmit,
    reset: resetNote,
    formState: { errors: noteErrors },
  } = useForm<AddNoteValues>({ resolver: zodResolver(addNoteSchema) })

  const {
    register: registerContact,
    handleSubmit: handleContactSubmit,
    reset: resetContact,
    formState: { errors: contactErrors },
  } = useForm<AddContactValues>({ resolver: zodResolver(addContactSchema) })

  if (isLoading) return <p className="text-gray-600">Loading...</p>
  if (!customer) return null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">{customer.name}</h1>
      <p className="mt-1 text-gray-600">
        {customer.email ?? 'No email'} · {customer.phone ?? 'No phone'}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">Contacts</h2>
          {customer.contacts.length === 0 && (
            <p className="mt-2 text-gray-600">No contacts yet.</p>
          )}
          <ul className="mt-2 flex flex-col gap-2">
            {customer.contacts.map((contact) => (
              <li key={contact.id} className="text-gray-600">
                {contact.fullName}
                {contact.email ? ` · ${contact.email}` : ''}
              </li>
            ))}
          </ul>

          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={handleContactSubmit((values) => contactMutation.mutate(values))}
          >
            {contactMutation.isError && (
              <Callout.Root color="red">
                <Callout.Text>
                  {contactMutation.error instanceof ApiError
                    ? contactMutation.error.message
                    : 'Something went wrong.'}
                </Callout.Text>
              </Callout.Root>
            )}
            <TextField.Root placeholder="Contact name" {...registerContact('fullName')} />
            {contactErrors.fullName && (
              <span className="text-sm text-red-600">{contactErrors.fullName.message}</span>
            )}
            <TextField.Root
              type="email"
              placeholder="Contact email (optional)"
              {...registerContact('email')}
            />
            <Button type="submit" size="1" disabled={contactMutation.isPending}>
              Add contact
            </Button>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">Notes</h2>
          {customer.notes.length === 0 && <p className="mt-2 text-gray-600">No notes yet.</p>}
          <ul className="mt-2 flex flex-col gap-3">
            {customer.notes.map((note) => (
              <li key={note.id} className="rounded border border-gray-200 p-3 text-gray-700">
                <p>{note.body}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>

          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={handleNoteSubmit((values) => noteMutation.mutate(values.body))}
          >
            {noteMutation.isError && (
              <Callout.Root color="red">
                <Callout.Text>
                  {noteMutation.error instanceof ApiError
                    ? noteMutation.error.message
                    : 'Something went wrong.'}
                </Callout.Text>
              </Callout.Root>
            )}
            <textarea
              className="rounded border border-gray-300 p-2 text-sm"
              rows={3}
              placeholder="Add a note..."
              {...registerNote('body')}
            />
            {noteErrors.body && (
              <span className="text-sm text-red-600">{noteErrors.body.message}</span>
            )}
            <Button type="submit" size="1" disabled={noteMutation.isPending}>
              Add note
            </Button>
          </form>
        </section>
      </div>
    </div>
  )
}
