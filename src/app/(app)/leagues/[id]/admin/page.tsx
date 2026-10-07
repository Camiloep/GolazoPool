import LeagueSettingsForm from '@/components/leagues/LeagueSettingsForm'
import RemoveMemberButton from '@/components/leagues/RemoveMemberButton'
import {
  formatPredictionLockWindow,
  getMemberPredictionVisibilityRuleText,
  getPredictionEditRuleText,
  getTieBreakerRuleText,
  getDefaultLeagueSettings,
  isMissingLeagueSettingsTable,
  normalizeLeagueSettings,
} from '@/lib/league-settings'
import { GENERAL_SCORING_RULE } from '@/lib/predictions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export default async function LeagueAdminPage({
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

  const [{ data: league }, { data: membership }, settingsResponse, { data: members }] = await Promise.all([
    supabase.from('leagues').select('id, name').eq('id', leagueId).single(),
    supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('league_settings')
      .select('league_id, rules, prizes, allow_prediction_edits, member_prediction_visibility, member_prediction_view_mode, require_match_prediction_for_pick_visibility, tie_breaker_order, prediction_lock_minutes, prediction_lock_mode, updated_at, updated_by')
      .eq('league_id', leagueId)
      .maybeSingle(),
    supabase
      .from('league_members')
      .select('user_id, role, joined_at, profiles(name)')
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true }),
  ])

  if (!league || !membership) notFound()
  if (membership.role !== 'admin') redirect(`/leagues/${leagueId}`)

  const settingsTableMissing = isMissingLeagueSettingsTable(settingsResponse.error)
  const settings = settingsTableMissing
    ? getDefaultLeagueSettings(leagueId)
    : normalizeLeagueSettings(leagueId, settingsResponse.data)

  return (
    <div className="space-y-6 pb-28">
      <div>
        <Link className="brand-link text-sm" href={`/leagues/${leagueId}`}>
          Volver a {league.name}
        </Link>
        <h1 className="brand-display mt-2 text-4xl font-black text-foreground">Administracion</h1>
        <p className="mt-2 text-sm text-muted">
          Ajusta premios, reglas adicionales y las reglas activables de pronosticos para esta liga.
        </p>
      </div>

      {settingsTableMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La base de datos todavia no tiene la tabla <code>league_settings</code>. Aplica el script
          {' '}
          <code>database/league_settings.sql</code>
          {' '}
          y vuelve a intentar.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <LeagueSettingsForm
            initialAllowPredictionEdits={settings.allow_prediction_edits}
            initialLockMinutes={settings.prediction_lock_minutes}
            initialMemberPredictionVisibility={settings.member_prediction_visibility}
            initialMemberPredictionViewMode={settings.member_prediction_view_mode}
            initialPredictionLockMode={settings.prediction_lock_mode}
            initialPrizes={settings.prizes ?? ''}
            initialRequireMatchPredictionForPickVisibility={settings.require_match_prediction_for_pick_visibility}
            initialRules={settings.rules ?? ''}
            initialTieBreakerOrder={settings.tie_breaker_order}
            leagueId={leagueId}
          />

          {members && members.length > 0 && (
            <div className="brand-panel rounded-panel p-6">
              <h2 className="brand-display text-2xl font-black text-foreground">Miembros</h2>
              <p className="mt-2 text-sm text-muted">
                Puedes expulsar miembros de la liga. No puedes expulsar administradores.
              </p>
              <ul className="mt-4 divide-y divide-brand-line">
                {members.map((m) => {
                  const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles
                  const name = profile?.name ?? 'Sin nombre'
                  const isMe = m.user_id === user.id
                  const isAdmin = m.role === 'admin'

                  return (
                    <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {name}
                          {isMe && <span className="ml-1.5 text-xs font-normal text-muted">(tu)</span>}
                        </p>
                        {isAdmin && (
                          <p className="text-xs font-semibold text-brand-green-strong">Admin</p>
                        )}
                      </div>
                      {!isMe && !isAdmin && (
                        <RemoveMemberButton
                          leagueId={leagueId}
                          memberName={name}
                          targetUserId={m.user_id}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="brand-dark-card rounded-panel p-5 text-white">
            <p className="brand-kicker text-kicker-sm tracking-brand-wide text-white/70">Regla global</p>
            <p className="mt-2 text-sm text-white/80">{GENERAL_SCORING_RULE}</p>
          </div>

          <div className="brand-dark-card rounded-panel p-5 text-white">
            <p className="brand-kicker text-kicker-sm tracking-brand-wide text-white/70">Vista previa</p>
            <h2 className="brand-display mt-2 text-lg font-black">Regla de bloqueo</h2>
            <p className="mt-2 text-sm text-white/80">
              Los pronosticos se cierran {formatPredictionLockWindow(
                settings.prediction_lock_minutes,
                settings.prediction_lock_mode
              )}.
            </p>
            <p className="mt-2 text-sm text-white/80">
              {getPredictionEditRuleText(settings.allow_prediction_edits)}
            </p>
            <p className="mt-2 text-sm text-white/80">
              {getMemberPredictionVisibilityRuleText({
                memberPredictionViewMode: settings.member_prediction_view_mode,
                memberPredictionVisibility: settings.member_prediction_visibility,
                predictionLockMinutes: settings.prediction_lock_minutes,
                predictionLockMode: settings.prediction_lock_mode,
                requireMatchPredictionForPickVisibility:
                  settings.require_match_prediction_for_pick_visibility,
              })}
            </p>
            <p className="mt-2 text-sm text-white/80">
              {getTieBreakerRuleText(settings.tie_breaker_order)}
            </p>
          </div>

          <div className="brand-panel rounded-panel p-5">
            <h2 className="brand-display text-xl font-black text-foreground">Notas</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>Los cambios son visibles para todos los miembros de la liga.</li>
              <li>La regla de puntaje es global y no se edita por liga.</li>
              <li>El bloqueo se valida en servidor aunque alguien intente saltarse la interfaz.</li>
              <li>El modo “primer partido” cierra todos los picks usando la fecha del debut del mundial.</li>
              <li>{getTieBreakerRuleText(settings.tie_breaker_order)}</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
