'use client'

import Link from 'next/link'
import { useActionState } from 'react'

type ActionFn = (formData: FormData) => Promise<{ error: string } | undefined>

export default function VerifyForm({ action }: { action: ActionFn }) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error: string } | undefined, formData: FormData) => action(formData),
    undefined
  )

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="brand-display text-sm font-bold text-foreground" htmlFor="token">
          Codigo de verificacion
        </label>
        <input
          autoComplete="one-time-code"
          className="brand-input brand-display mt-1.5 w-full rounded-xl px-4 py-3 text-center text-2xl font-black tracking-brand-pin"
          id="token"
          inputMode="numeric"
          maxLength={8}
          minLength={6}
          name="token"
          pattern="[0-9]{6,8}"
          placeholder="000000"
          required
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
        {pending ? 'Verificando...' : 'Entrar'}
      </button>

      <p className="text-center text-sm text-muted">
        Correo incorrecto?{' '}
        <Link className="brand-link" href="/login">
          Volver
        </Link>
      </p>
    </form>
  )
}
