'use client'

import { saveAppSettings } from '@/actions/app-settings'
import { getResultEditRuleText } from '@/lib/app-settings'
import { useActionState, useState } from 'react'

interface Props {
  leagueId: string
  initialAllowResultEdits: boolean
}

export default function ResultSettingsForm({
  leagueId,
  initialAllowResultEdits,
}: Props) {
  const [state, formAction, pending] = useActionState(
    (_prev: { error?: string; success?: boolean } | undefined, formData: FormData) =>
      saveAppSettings(formData),
    undefined
  )
  const [allowResultEdits, setAllowResultEdits] = useState(initialAllowResultEdits)

  return (
    <form action={formAction} className="brand-panel-soft space-y-4 rounded-3xl p-4">
      <input name="league_id" type="hidden" value={leagueId} />

      <div>
        <p className="brand-kicker text-kicker-sm tracking-brand-wide">Regla global</p>
        <h3 className="brand-display mt-2 text-xl font-black text-foreground">Edicion de resultados oficiales</h3>
        <p className="mt-1 text-sm text-muted">
          Esta regla aplica a todas las ligas porque los marcadores oficiales son compartidos.
        </p>
      </div>

      <label className="flex items-center justify-between gap-4 rounded-2xl border border-brand-line px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Permitir correcciones despues de cerrar</p>
          <p className="mt-1 text-xs text-muted">
            Si lo apagas, un partido finalizado ya no se podra volver a editar.
          </p>
        </div>
        <span className="relative inline-flex items-center">
          <input
            checked={allowResultEdits}
            className="peer sr-only"
            name="allow_result_edits"
            onChange={event => setAllowResultEdits(event.target.checked)}
            type="checkbox"
          />
          <span className="h-7 w-12 rounded-full bg-brand-line transition peer-checked:bg-brand-green-strong" />
          <span className="absolute left-1 h-5 w-5 rounded-full bg-white transition peer-checked:translate-x-5" />
        </span>
      </label>

      <p className="border-l-2 border-brand-line pl-3 py-0.5 text-xs text-muted">
        {getResultEditRuleText(allowResultEdits)}
      </p>

      <div className="flex items-center gap-3">
        <button
          className="brand-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Guardando...' : 'Guardar regla global'}
        </button>
        {state?.success && (
          <p className="text-sm font-semibold text-brand-green-strong">Regla global guardada.</p>
        )}
      </div>

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  )
}
