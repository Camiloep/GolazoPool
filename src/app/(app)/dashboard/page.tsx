import JoinLeagueForm from '@/components/leagues/JoinLeagueForm'
import { getLeagueRankings } from '@/lib/dashboard-rankings'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('league_members')
    .select('role, league:leagues(id, name, description, invite_code)')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  const leagues = memberships ?? []

  const leagueRefs = leagues
    .map(({ league: leagueRaw }) => {
      const league = Array.isArray(leagueRaw) ? leagueRaw[0] : leagueRaw
      if (!league) return null
      return { id: league.id, name: league.name }
    })
    .filter((x): x is { id: string; name: string } => x !== null)

  const leagueRankings = await getLeagueRankings(supabase, leagueRefs)

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="brand-kicker text-kicker-lg">Tus competencias</p>
            <h1 className="brand-display mt-2 text-4xl font-black text-foreground">Mis ligas</h1>
            <p className="mt-2 text-sm text-muted">
              Crea una liga para administrarla o unete con un codigo de invitacion.
            </p>
          </div>
          <Link
            className="brand-button-primary inline-flex items-center rounded-2xl px-5 py-3 text-sm font-semibold"
            href="/leagues/new"
          >
            + Crear liga
          </Link>
        </div>

        {leagues.length === 0 ? (
          <div className="brand-panel rounded-panel py-16 text-center">
            <p className="brand-display text-2xl font-black text-foreground">Aun no tienes ligas</p>
            <p className="mt-2 text-sm text-muted">Crea una nueva o unete con un codigo.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {leagues.map(({ role, league: leagueRaw }) => {
              if (!leagueRaw) return null
              const league = Array.isArray(leagueRaw) ? leagueRaw[0] : leagueRaw
              if (!league) return null

              return (
                <Link
                  className="brand-card group flex flex-col gap-3 rounded-panel p-5 transition hover:-translate-y-0.5 hover:border-brand-green"
                  href={`/leagues/${league.id}`}
                  key={league.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="brand-display text-xl font-black text-foreground group-hover:text-brand-blue">
                      {league.name}
                    </h2>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${
                        role === 'admin' ? 'brand-chip-admin' : 'brand-chip-member'
                      }`}
                    >
                      {role === 'admin' ? 'Admin' : 'Miembro'}
                    </span>
                  </div>
                  {league.description && (
                    <p className="line-clamp-2 text-sm text-muted">{league.description}</p>
                  )}
                  <p className="mt-auto text-xs font-mono text-muted/78">
                    Codigo: {league.invite_code}
                  </p>
                </Link>
              )
            })}
          </div>
        )}

        {leagueRankings.length > 0 && (
          <div>
            <p className="brand-kicker text-kicker-lg">Rankings</p>
            <h2 className="brand-display mt-2 text-2xl font-black text-foreground">Top 3 por liga</h2>
            <p className="mt-2 text-sm text-muted">Los 3 jugadores con mas puntos en cada una de tus ligas.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {leagueRankings.map(league => (
                <div className="brand-card rounded-panel p-5" key={league.id}>
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      className="brand-display min-w-0 flex-1 truncate text-lg font-black text-foreground transition hover:text-brand-blue"
                      href={`/leagues/${league.id}`}
                    >
                      {league.name}
                    </Link>
                    <Link className="brand-link shrink-0 text-xs font-bold" href={`/leagues/${league.id}`}>
                      Ver liga
                    </Link>
                  </div>
                  {league.hasPoints ? (
                    <div className="mt-3 flex flex-col gap-1.5">
                      {league.top3.map((member, index) => {
                        const isMe = member.userId === user.id
                        return (
                          <div
                            className={`grid grid-cols-[1.5rem_1fr_auto] items-center gap-2 rounded-2xl border px-3 py-2.5 ${
                              isMe ? 'border-brand-green bg-brand-green/10' : 'border-brand-line brand-panel-soft'
                            }`}
                            key={member.userId}
                          >
                            <span className="brand-display text-center text-sm font-black text-muted">
                              {index + 1}
                            </span>
                            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                              {member.name ?? '-'}
                              {isMe && (
                                <span className="ml-1 text-xs font-bold text-brand-green-strong">(Tu)</span>
                              )}
                            </span>
                            <span className="shrink-0 text-sm font-black text-foreground">{member.points} pts</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted">Aun no hay partidos puntuados en esta liga.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="brand-panel rounded-panel p-6">
          <h2 className="brand-display text-2xl font-black text-foreground">Unirse a una liga</h2>
          <p className="mt-2 text-sm text-muted">
            Ingresa el codigo de invitacion que te compartieron.
          </p>
          <JoinLeagueForm />
        </div>
      </div>
    </div>
  )
}
