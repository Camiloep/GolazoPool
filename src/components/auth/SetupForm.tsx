'use client'

import DataUseNote from '@/components/legal/DataUseNote'
import { useActionState } from 'react'

type ActionFn = (formData: FormData) => Promise<{ error: string } | undefined>

export default function SetupForm({ action, defaultName }: { action: ActionFn; defaultName: string }) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error: string } | undefined, formData: FormData) => action(formData),
    undefined
  )

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="brand-display text-sm font-bold text-foreground" htmlFor="name">
          Tu nombre o apodo
        </label>
        <input
          autoFocus
          className="brand-input mt-1.5 w-full rounded-xl px-4 py-3 text-sm"
          defaultValue={defaultName}
          id="name"
          maxLength={40}
          name="name"
          placeholder="p.ej. Camilo o El Crack"
          required
        />
      </div>

      <DataUseNote>
        Tu nombre o apodo podra ser visible para administradores y miembros de las ligas en las
        que participes, junto con tu actividad dentro del juego.
      </DataUseNote>

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
      <button
        className="brand-button-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Guardando...' : 'Continuar'}
      </button>
    </form>
  )
}
