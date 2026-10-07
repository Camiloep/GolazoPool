import MatchResultForm from '@/components/leagues/MatchResultForm'
import OpenFootballSyncForm from '@/components/leagues/OpenFootballSyncForm'
import ResultSettingsForm from '@/components/leagues/ResultSettingsForm'
import { isMissingAppAdminsTable } from '@/lib/app-admins'
import {
  getResultEditRuleText,
  isMissingAppSettingsTable,
  normalizeAppSettings,
} from '@/lib/app-settings'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export default async function LeagueResultsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: leagueId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [
    { data: league },
    { data: membership },
    appAdminResponse,
    appSettingsResponse,
    { data: matches },
  ] = await Promise.all([
    supabase.from('leagues').select('id, name').eq('id', leagueId).single(),
    supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('app_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('app_settings')
      .select('singleton, allow_result_edits, updated_at, updated_by')
      .eq('singleton', true)
      .maybeSingle(),
    supabase
      .from('matches')
      .select(`
        id,
        match_number,
        phase,
        group_letter,
        starts_at,
        venue,
        label,
        status,
        home_score,
        away_score,
        home_team:teams!matches_home_team_id_fkey(name, code, flag_emoji),
        away_team:teams!matches_away_team_id_fkey(name, code, flag_emoji)
      `)
      .order('starts_at'),
  ])

  if (!league || !membership) notFound()

  const appAdminsTableMissing = isMissingAppAdminsTable(appAdminResponse.error)
  const isSuperAdmin = !appAdminsTableMissing && Boolean(appAdminResponse.data?.user_id)
  const appSettingsTableMissing = isMissingAppSettingsTable(appSettingsResponse.error)
  const appSettings = normalizeAppSettings(appSettingsResponse.data)

  if (!appAdminsTableMissing && !isSuperAdmin) {
    redirect(`/leagues/${leagueId}`)
  }

  const openMatches = (matches ?? []).filter(match => match.status !== 'finished')
  const finishedMatches = (matches ?? []).filter(match => match.status === 'finished')

  return (
    <div className="space-y-6">
      <div>
        <Link className="brand-link text-sm" href={`/leagues/${leagueId}`}>
          Volver a {league.name}
        </Link>
        <h1 className="brand-display mt-2 text-4xl font-black text-foreground">Resultados oficiales</h1>
        <p className="mt-2 text-sm text-muted">
          Cierra partidos, corrige marcadores y actualiza el ranking global desde una seccion dedicada.
        </p>
      </div>

      {appAdminsTableMissing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La base de datos todavia no tiene la tabla <code>app_admins</code>. Aplica el script
          {' '}
          <code>database/app_admins.sql</code>
          {' '}
          y agrega tu usuario como super admin.
        </div>
      ) : (
        <section className="brand-panel space-y-4 rounded-panel p-6">
          <div>
            <p className="brand-kicker text-kicker-sm tracking-brand-wide">Super admin</p>
            <h2 className="brand-display mt-2 text-2xl font-black text-foreground">Resultados de partidos</h2>
            <p className="mt-1 text-sm text-muted">
              Los resultados del calendario son globales. Cualquier cambio afecta el ranking de todas las ligas.
            </p>
            <p className="mt-1 text-sm text-muted">{getResultEditRuleText(appSettings.allow_result_edits)}</p>
          </div>

          {appSettingsTableMissing ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              La base de datos todavia no tiene la tabla <code>app_settings</code>. Aplica el script
              {' '}
              <code>database/app_settings.sql</code>
              {' '}
              para activar las reglas globales de resultados.
            </div>
          ) : (
            <ResultSettingsForm
              initialAllowResultEdits={appSettings.allow_result_edits}
              leagueId={leagueId}
            />
          )}

          <OpenFootballSyncForm leagueId={leagueId} />

          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="brand-kicker text-kicker-sm tracking-brand-wide">Pendientes de cierre</h3>
                <span className="brand-chip-member rounded-full px-2.5 py-1 text-xs font-bold">
                  {openMatches.length}
                </span>
              </div>

              {openMatches.length === 0 ? (
                <p className="brand-panel-soft rounded-2xl px-4 py-5 text-sm text-muted">
                  No hay partidos pendientes por cerrar.
                </p>
              ) : (
                <div className="grid gap-3 xl:grid-cols-2">
                  {openMatches.map(match => (
                    <MatchResultForm
                      canEditFinishedResults={appSettings.allow_result_edits}
                      key={match.id}
                      leagueId={leagueId}
                      match={match}
                    />
                  ))}
                </div>
              )}
            </div>

            {finishedMatches.length > 0 && (
              <details className="brand-panel-soft rounded-2xl p-4">
                <summary className="cursor-pointer list-none text-sm font-black uppercase tracking-brand-wide text-muted">
                  Resultados cargados ({finishedMatches.length})
                </summary>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  {finishedMatches.map(match => (
                    <MatchResultForm
                      canEditFinishedResults={appSettings.allow_result_edits}
                      key={match.id}
                      leagueId={leagueId}
                      match={match}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
