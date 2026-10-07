'use client'

import { removeMember } from '@/actions/leagues'
import { useActionState, useState } from 'react'

interface Props {
  leagueId: string
  targetUserId: string
  memberName: string
}

export default function RemoveMemberButton({ leagueId, targetUserId, memberName }: Props) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) =>
      removeMember(formData),
    undefined
  )

  if (state?.success) {
    return <span className="text-xs text-muted">Expulsado</span>
  }

  return (
    <>
      <button
        className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
        onClick={() => setOpen(true)}
        type="button"
      >
        Expulsar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-brand-blue/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="brand-panel relative w-full max-w-sm rounded-panel p-6">
            <h2 className="brand-display text-xl font-black text-foreground">Expulsar miembro</h2>
            <p className="mt-2 text-sm text-muted">
              Seguro que quieres expulsar a <span className="font-semibold text-foreground">{memberName}</span>?
              Esta accion no se puede deshacer.
            </p>

            {state?.error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                {state.error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                className="brand-button-secondary rounded-xl px-4 py-2 text-sm font-semibold"
                disabled={pending}
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancelar
              </button>

              <form action={formAction}>
                <input name="league_id" type="hidden" value={leagueId} />
                <input name="target_user_id" type="hidden" value={targetUserId} />
                <button
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? 'Expulsando...' : 'Si, expulsar'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
