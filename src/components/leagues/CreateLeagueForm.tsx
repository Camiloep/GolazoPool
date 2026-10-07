'use client'

import { useActionState } from 'react'

type ActionFn = (formData: FormData) => Promise<{ error: string } | undefined>

export default function CreateLeagueForm({ action }: { action: ActionFn }) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error: string } | undefined, formData: FormData) => action(formData),
    undefined
  )

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="brand-display text-sm font-bold text-foreground" htmlFor="name">
          Nombre de la liga
        </label>
        <input
          className="brand-input mt-1.5 w-full rounded-xl px-4 py-3 text-sm"
          id="name"
          name="name"
          placeholder="Liga de la oficina"
          required
        />
      </div>
      <div>
        <label className="brand-display text-sm font-bold text-foreground" htmlFor="description">
          Descripcion <span className="font-sans font-normal text-muted">(opcional)</span>
        </label>
        <textarea
          className="brand-input mt-1.5 min-h-28 w-full rounded-xl px-4 py-3 text-sm"
          id="description"
          name="description"
          placeholder="Liga entre companeros de trabajo..."
          rows={3}
        />
      </div>

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        className="brand-button-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Creando...' : 'Crear liga'}
      </button>
    </form>
  )
}
