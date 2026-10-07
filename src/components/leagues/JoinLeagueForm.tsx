'use client'

import { joinLeague } from '@/actions/leagues'
import { useActionState } from 'react'

export default function JoinLeagueForm() {
  const [state, formAction, pending] = useActionState(
    (_prev: { error: string } | undefined, formData: FormData) => joinLeague(formData),
    undefined
  )

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div className="flex gap-3">
        <input
          className="brand-input flex-1 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-brand-code-wide"
          maxLength={8}
          name="invite_code"
          placeholder="CODIGO"
          required
        />
        <button
          className="brand-button-primary rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? '...' : 'Unirse'}
        </button>
      </div>
      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  )
}
