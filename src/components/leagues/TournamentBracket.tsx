/* eslint-disable @next/next/no-img-element */
'use client'

import { formatMatchDate, formatMatchTime } from '@/lib/datetime'
import { flagUrl } from '@/lib/flags'
import { type BracketRound } from '@/lib/bracket'
import { parseBracketSides } from '@/lib/standings'
import Link from 'next/link'

export interface BracketCard {
  id: string
  matchNumber: number
  phase: string
  startsAt: string
  venue: string | null
  label: string | null
  status: string
  homeTeam: { name: string; code: string } | null
  awayTeam: { name: string; code: string } | null
  homeScore: number | null
  awayScore: number | null
}

// Alto reservado por cada hoja (dieciseisavos). Una ronda con la mitad de cruces
// usa slots del doble de alto, asi todas las columnas miden lo mismo y cada cruce
// queda centrado justo entre sus dos alimentadores.
const SLOT_PX = 84

function TeamRow({
  team,
  placeholder,
  score,
  isWinner,
  dimmed,
}: {
  team: { name: string; code: string } | null
  placeholder: string
  score: number | null
  isWinner: boolean
  dimmed: boolean
}) {
  const url = team?.code ? flagUrl(team.code) : null

  return (
    <div className={`flex items-center gap-1.5 ${dimmed ? 'opacity-45' : ''}`}>
      {url ? (
        <img alt={team?.name ?? ''} className="h-3.5 w-5 shrink-0 rounded-xs object-cover" src={url} />
      ) : (
        <span className="grid h-3.5 w-5 shrink-0 place-items-center rounded-xs bg-white/10 text-3xs text-muted">
          ?
        </span>
      )}
      <span
        className={`min-w-0 flex-1 truncate text-xs leading-tight ${
          team ? (isWinner ? 'font-bold text-foreground' : 'font-semibold text-foreground') : 'font-medium text-muted'
        }`}
      >
        {team?.name ?? placeholder}
      </span>
      {score !== null && (
        <span className={`shrink-0 text-xs tabular-nums ${isWinner ? 'font-black text-foreground' : 'font-semibold text-muted'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

function BracketMatchCard({ match, leagueId }: { match: BracketCard; leagueId: string }) {
  const sides = parseBracketSides(match.label)
  const isFinished = match.status === 'finished' && match.homeScore !== null && match.awayScore !== null
  const isLive = match.status === 'in_progress'
  const homeWins = isFinished && (match.homeScore as number) > (match.awayScore as number)
  const awayWins = isFinished && (match.awayScore as number) > (match.homeScore as number)
  const showScore = isFinished || isLive

  return (
    <Link
      href={`/leagues/${leagueId}/predictions?match=${match.id}`}
      className="brand-card block w-full rounded-2xl px-2.5 py-2 transition hover:border-brand-green"
    >
      <div className="flex flex-col gap-1">
        <TeamRow
          team={match.homeTeam}
          placeholder={sides.home ?? 'Por definir'}
          score={showScore ? match.homeScore : null}
          isWinner={homeWins}
          dimmed={isFinished && awayWins}
        />
        <TeamRow
          team={match.awayTeam}
          placeholder={sides.away ?? 'Por definir'}
          score={showScore ? match.awayScore : null}
          isWinner={awayWins}
          dimmed={isFinished && homeWins}
        />
      </div>
      <div className="mt-1.5 flex items-center gap-1 border-t border-brand-line/60 pt-1 text-3xs">
        <span className="shrink-0 whitespace-nowrap font-semibold text-muted">
          {formatMatchDate(match.startsAt, { day: 'numeric', month: 'short' })} ·{' '}
          {formatMatchTime(match.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
        </span>
        {isLive ? (
          <span className="shrink-0 font-bold text-brand-green-strong">· En vivo</span>
        ) : match.venue ? (
          // `truncate` necesita un display tipo bloque: en `inline` el overflow no
          // aplica y la sede larga se desborda de la tarjeta. min-w-0 deja encogerlo.
          <span className="hidden min-w-0 flex-1 truncate text-muted/75 sm:block">· {match.venue}</span>
        ) : null}
      </div>
    </Link>
  )
}

// Una "ranura" de alto fijo con el cruce centrado. El canal izquierdo (w-5) aloja
// el conector de codo hacia los dos alimentadores; para los dieciseisavos queda
// vacio (son hojas) y solo sirve para alinear el ancho de las tarjetas.
function Slot({
  heightPx,
  connectorPx,
  children,
}: {
  heightPx: number
  connectorPx: number | null
  children: React.ReactNode
}) {
  return (
    <div className="flex items-stretch" style={{ height: `${heightPx}px` }}>
      <div className="relative w-5 shrink-0">
        {connectorPx !== null && (
          <div
            className="absolute right-0 top-1/2 w-5 -translate-y-1/2 rounded-r-md border-y border-r border-brand-line-strong"
            style={{ height: `${connectorPx}px` }}
          />
        )}
      </div>
      {/* min-w-0: sin esto el flex item no encoge bajo el min-content de la tarjeta
          (la sede larga la inflaba y la tarjeta se salia de la columna). */}
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  )
}

export default function TournamentBracket({
  rounds,
  thirdPlace,
  leagueId,
}: {
  rounds: BracketRound<BracketCard>[]
  thirdPlace: BracketCard | null
  leagueId: string
}) {
  const leafCount = rounds[0]?.matches.length ?? 1
  const totalHeight = leafCount * SLOT_PX

  return (
    // Solo scroll nativo (rueda/trackpad/scrollbar en desktop, tactil en movil).
    // Alto acotado por el contenedor padre, asi el box hace su propio scroll.
    <div
      className="flex h-full items-start overflow-auto rounded-2xl pb-3"
      style={{ scrollbarWidth: 'thin' }}
    >
      {rounds.map((round, roundIndex) => {
        const slotHeight = totalHeight / round.matches.length
        // El conector mide medio slot (la distancia entre los centros de sus dos
        // alimentadores); los dieciseisavos (roundIndex 0) no llevan conector.
        const connectorPx = roundIndex === 0 ? null : slotHeight / 2
        const isFinal = roundIndex === rounds.length - 1

        return (
          <div key={round.phase} className="flex w-40 shrink-0 flex-col sm:w-52">
              <div className="mb-2 ml-5 flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5">
                <span className="brand-kicker text-kicker-2xs tracking-brand-wide">{round.title}</span>
                <span className="text-3xs font-bold text-muted">{round.matches.length}</span>
              </div>

              <div className="relative" style={{ height: `${totalHeight}px` }}>
                {round.matches.map(match => (
                  <Slot key={match.id} heightPx={slotHeight} connectorPx={connectorPx}>
                    <BracketMatchCard match={match} leagueId={leagueId} />
                  </Slot>
                ))}

                {isFinal && thirdPlace && (
                  <div
                    className="absolute inset-x-0 pr-1 pl-5"
                    style={{ top: `${totalHeight / 2 + 64}px` }}
                  >
                    <p className="brand-kicker mb-1 text-kicker-2xs tracking-brand-wide text-muted/80">
                      Tercer puesto
                    </p>
                    <BracketMatchCard match={thirdPlace} leagueId={leagueId} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
    </div>
  )
}
