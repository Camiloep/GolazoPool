'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef } from 'react'

import { joinLeague } from '@/actions/leagues'

type JoinInviteLinkFormProps = {
  inviteCode: string
}

export default function JoinInviteLinkForm({ inviteCode }: JoinInviteLinkFormProps) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error: string } | undefined, formData: FormData) => joinLeague(formData),
    undefined
  )
  const formRef = useRef<HTMLFormElement>(null)
  const autoSubmitKey = `join-league:${inviteCode}`
  const autoSubmitWindowMs = 3000

  useEffect(() => {
    if (typeof window === 'undefined') return
    const lastAttempt = Number(sessionStorage.getItem(autoSubmitKey) ?? '0')
    if (Date.now() - lastAttempt < autoSubmitWindowMs) return

    sessionStorage.setItem(autoSubmitKey, String(Date.now()))
    formRef.current?.requestSubmit()
  }, [autoSubmitKey, autoSubmitWindowMs])

  useEffect(() => {
    if (!state?.error || typeof window === 'undefined') return
    sessionStorage.removeItem(autoSubmitKey)
  }, [autoSubmitKey, state?.error])

  return (
    <form action={formAction} className="space-y-4" ref={formRef}>
      <input name="invite_code" type="hidden" value={inviteCode} />

      <div className="brand-panel-soft rounded-xl px-4 py-3 text-left">
        <p className="brand-kicker text-kicker-sm tracking-brand">Codigo</p>
        <p className="mt-1 font-mono text-sm font-semibold tracking-brand-code text-foreground">
          {inviteCode}
        </p>
      </div>

      {state?.error ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
          <button
            className="brand-button-primary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Procesando...' : 'Intentar de nuevo'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {pending ? 'Procesando invitacion...' : 'Un momento...'}
          </p>
          <button
            className="brand-button-secondary w-full rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Procesando...' : 'Unirse manualmente'}
          </button>
        </div>
      )}

      <Link
        className="brand-link inline-block text-sm underline underline-offset-4"
        href="/dashboard"
      >
        Volver al inicio
      </Link>
    </form>
  )
}
