import LeagueSidebar from '@/components/leagues/LeagueSidebar'
import { isMissingAppAdminsTable } from '@/lib/app-admins'
import { isMissingLeagueSettingsTable, normalizeLeagueSettings } from '@/lib/league-settings'
import { buildLeaderboard } from '@/lib/predictions'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode
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
    { data: userLeagueMemberships },
    { data: members },
    { data: allPredictions },
    { data: upcomingMatches },
    { data: myConfirmedPredictions },
    settingsResponse,
  ] = await Promise.all([
    supabase.from('leagues').select('id, name, invite_code').eq('id', leagueId).single(),
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
      .from('league_members')
      .select('role, league:leagues(id, name)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false }),
    supabase
      .from('league_members')
      .select('role, profile:profiles(id, name)')
      .eq('league_id', leagueId)
      .order('joined_at'),
    supabase
      .from('predictions')
      .select('user_id, home_score, away_score, confirmed_at, created_at, match:matches(home_score, away_score, status, starts_at)')
      .eq('league_id', leagueId)
      .eq('confirmed', true),
    supabase
      .from('matches')
      .select(
        'id, starts_at, home_team:teams!matches_home_team_id_fkey(name, flag_emoji), away_team:teams!matches_away_team_id_fkey(name, flag_emoji)'
      )
      .eq('status', 'scheduled')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at'),
    supabase
      .from('predictions')
      .select('match_id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .eq('confirmed', true),
    supabase
      .from('league_settings')
      .select('league_id, tie_breaker_order')
      .eq('league_id', leagueId)
      .maybeSingle(),
  ])

  if (!league) notFound()

  if (!membership) {
    return (
      <div className="brand-stage flex items-center justify-center px-5">
        <div className="brand-panel w-full max-w-sm rounded-panel p-8 text-center">
          <p className="text-3xl">🔒</p>
          <h1 className="brand-display mt-4 text-2xl font-black text-foreground">No perteneces a esta liga</h1>
          <p className="mt-2 text-sm text-muted">
            Necesitas una invitacion para acceder. Pidele el codigo al administrador.
          </p>
          <Link
            className="brand-button-primary mt-6 inline-flex items-center rounded-2xl px-5 py-3 text-sm font-semibold"
            href="/dashboard"
          >
            Ir al dashboard
          </Link>
        </div>
      </div>
    )
  }

  const isSuperAdmin =
    !isMissingAppAdminsTable(appAdminResponse.error) &&
    Boolean(appAdminResponse.data?.user_id)

  const allLeagues = (userLeagueMemberships ?? [])
    .map((m) => {
      const lg = Array.isArray(m.league) ? m.league[0] : m.league
      return lg ? { id: lg.id, name: lg.name, role: m.role } : null
    })
    .filter((x): x is { id: string; name: string; role: string } => x !== null)

  const leaderboardMembers = (members ?? []).map((member) => {
    const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile
    return { id: profile?.id ?? null, name: profile?.name ?? null, role: member.role }
  })
  const settings =
    settingsResponse.error && !isMissingLeagueSettingsTable(settingsResponse.error)
      ? normalizeLeagueSettings(leagueId, null)
      : normalizeLeagueSettings(leagueId, settingsResponse.data)
  const leaderboard = buildLeaderboard(
    leaderboardMembers,
    allPredictions ?? [],
    settings.tie_breaker_order
  )
  const userRankIndex = leaderboard.findIndex((e) => e.userId === user.id)
  const myPosition =
    userRankIndex >= 0
      ? {
          rank: userRankIndex + 1,
          points: leaderboard[userRankIndex].points,
          total: leaderboard.length,
        }
      : null

  const confirmedMatchIds = new Set((myConfirmedPredictions ?? []).map((p) => p.match_id))
  const rawNext = (upcomingMatches ?? []).find((m) => !confirmedMatchIds.has(m.id)) ?? null
  const nextMatch = rawNext
    ? {
        id: rawNext.id,
        startsAt: rawNext.starts_at,
        homeTeam: (Array.isArray(rawNext.home_team) ? rawNext.home_team[0] : rawNext.home_team) as {
          name: string
          flag_emoji: string
        } | null,
        awayTeam: (Array.isArray(rawNext.away_team) ? rawNext.away_team[0] : rawNext.away_team) as {
          name: string
          flag_emoji: string
        } | null,
      }
    : null

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/join/${league.invite_code}`

  return (
    <>
      <LeagueSidebar
        allLeagues={allLeagues}
        inviteUrl={inviteUrl}
        isAdmin={membership.role === 'admin'}
        isSuperAdmin={isSuperAdmin}
        leagueId={leagueId}
        leagueName={league.name}
        myPosition={myPosition}
        nextMatch={nextMatch}
      />
      <div className="lg:ml-68">
        <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">{children}</div>
      </div>
    </>
  )
}
