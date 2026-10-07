import StandingsTable from '@/components/leagues/StandingsTable'
import { LiveMatchRefresher } from '@/components/matches/LiveMatchRefresher'
import { buildGroupStandings, buildThirdsRanking } from '@/lib/standings'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export default async function LeagueStandingsPage({
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

  const [{ data: league }, { data: membership }, { data: teams }, { data: matches }] =
    await Promise.all([
      supabase.from('leagues').select('id, name').eq('id', leagueId).single(),
      supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .single(),
      supabase.from('teams').select('id, name, code, group_letter'),
      supabase
        .from('matches')
        .select('group_letter, home_team_id, away_team_id, home_score, away_score, status, starts_at')
        .eq('phase', 'group'),
    ])

  if (!league || !membership) notFound()

  const groups = buildGroupStandings(matches ?? [], teams ?? [])
  const thirdsRanking = buildThirdsRanking(groups)

  return (
    <div className="space-y-6">
      <LiveMatchRefresher />
      <div>
        <Link className="brand-link text-sm" href={`/leagues/${leagueId}`}>
          Volver a {league.name}
        </Link>
        <h1 className="brand-display mt-1 text-3xl font-black text-foreground">Tabla de posiciones</h1>
        <p className="mt-1 text-sm text-muted">Fase de grupos del Mundial 2026, actualizada en vivo.</p>
      </div>

      {groups.length === 0 ? (
        <div className="brand-panel rounded-panel py-12 text-center">
          <p className="brand-display text-xl font-black text-foreground">Aun no hay posiciones disponibles</p>
        </div>
      ) : (
        <StandingsTable groups={groups} thirdsRanking={thirdsRanking} />
      )}
    </div>
  )
}
