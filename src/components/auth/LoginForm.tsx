'use client'

import DataUseNote from '@/components/legal/DataUseNote'
import { useActionState } from 'react'

type ActionFn = (formData: FormData) => Promise<{ error: string } | undefined>

export default function LoginForm({ action, joinCode }: { action: ActionFn; joinCode?: string }) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error: string } | undefined, formData: FormData) => action(formData),
    undefined
  )

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {joinCode && <input type="hidden" name="join_code" value={joinCode} />}
      <div>
        <label className="brand-display text-sm font-bold text-foreground" htmlFor="email">
          Correo electronico
        </label>
        <input
          className="brand-input mt-1.5 w-full rounded-xl px-4 py-3 text-sm"
          id="email"
          name="email"
          placeholder="tucorreo@ejemplo.com"
          required
          type="email"
        />
      </div>

      <DataUseNote>
        Usaremos tu correo para autenticar el acceso, enviarte el codigo de verificacion y
        administrar tu cuenta y participacion en ligas.
      </DataUseNote>

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      <button
        className="brand-button-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Enviando...' : 'Recibir codigo'}
      </button>
    </form>
  )
}
