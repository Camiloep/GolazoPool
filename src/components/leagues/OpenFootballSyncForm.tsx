'use client'

import { syncOpenFootballMatches } from '@/actions/openfootball'
import { useActionState } from 'react'

interface Props {
  leagueId: string
}

export default function OpenFootballSyncForm({ leagueId }: Props) {
  const [state, formAction, pending] = useActionState(syncOpenFootballMatches, undefined)

  return (
    <form
      action={formAction}
      className="brand-panel-soft space-y-4 rounded-3xl p-4"
    >
      <input name="league_id" type="hidden" value={leagueId} />

      <div className="space-y-1">
        <p className="brand-kicker text-kicker-sm tracking-brand-wide">OpenFootball</p>
        <h3 className="brand-display text-xl font-black text-foreground">Sincronizar calendario y resultados</h3>
        <p className="text-sm text-muted">
          Toma el JSON publico del Mundial 2026, actualiza horarios, pasa partidos iniciados a
          <code> in_progress </code>
          y cierra automaticamente los que ya traigan marcador final.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="brand-button-primary inline-flex items-center rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Sincronizando...' : 'Sincronizar ahora'}
        </button>
        <p className="text-xs text-muted">
          Si el feed no trae un resultado, puedes seguir cerrando el partido manualmente.
        </p>
      </div>

      {state?.success && state.summary && (
        <div className="rounded-xl bg-brand-green-soft px-3 py-3 text-sm text-brand-green-strong">
          <p className="font-semibold">
            Sync listo. {state.summary.updatedMatches} partidos actualizados.
          </p>
          <p>
            {state.summary.scheduledMatches} programados, {state.summary.inProgressMatches} en juego,
            {' '} {state.summary.finishedMatches} finalizados.
          </p>
          {state.summary.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {state.summary.warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state?.error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}
    </form>
  )
}
