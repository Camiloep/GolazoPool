import { Plus_Jakarta_Sans } from 'next/font/google'
import type { LeaderboardEntry } from '@/lib/predictions'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'] })

type Rank = 1 | 2 | 3

// Color del badge circular de posicion para el top 3 (degradado claro -> base).
const MEDALS: Record<Rank, { from: string; to: string; text: string }> = {
  1: { from: '#F8CA59', to: '#E09B1B', text: '#5A3F0B' },
  2: { from: '#D7E0EC', to: '#9DAFC6', text: '#37445B' },
  3: { from: '#DE9858', to: '#B6692D', text: '#FFFFFF' },
}

interface LeaderboardBoardProps {
  entries: LeaderboardEntry[]
  currentUserId: string
  hasFinishedMatches?: boolean
  // Cambio de posicion por usuario (+sube / -baja / 0 igual). Opcional: requiere
  // un historico de la tabla que el modelo aun no almacena.
  positionChangeByUser?: Record<string, number>
}

// Puntos maximos por partido jugado (marcador exacto). El antiguo % de
// efectividad (aciertos/jugados) ignoraba que un exacto vale 3 y un acierto de
// resultado 1; este ratio de puntos refleja mejor el rendimiento real.
const MAX_POINTS_PER_MATCH = 3

function pointsProgress(entry: LeaderboardEntry) {
  const possible = (entry.playedPicks ?? 0) * MAX_POINTS_PER_MATCH
  const current = entry.points
  return { current, possible }
}

// Composicion de los pronosticos ya jugados, como porcentajes que suman 100:
// exactos (verde), ganador/empate (amarillo) y fallados (rojo).
function hitBreakdown(entry: LeaderboardEntry) {
  const played = entry.playedPicks ?? 0
  if (played <= 0) return { exactPct: 0, outcomePct: 0, missPct: 0, played: 0 }

  const exact = entry.exactHits
  const outcome = entry.winnerHits + entry.drawHits
  const miss = Math.max(0, played - exact - outcome)

  return {
    exactPct: (exact / played) * 100,
    outcomePct: (outcome / played) * 100,
    missPct: (miss / played) * 100,
    played,
  }
}

function TuChip() {
  return (
    <span
      className="shrink-0 rounded-full border px-1.5 py-0.5 text-3xs font-extrabold leading-none"
      style={{ borderColor: '#59E0A0', color: '#59E0A0' }}
    >
      TÚ
    </span>
  )
}

function AdminChip() {
  return (
    <span
      className="shrink-0 rounded-full border px-1.5 py-0.5 text-3xs font-extrabold leading-none"
      style={{ borderColor: '#9CF0B8', color: '#9CF0B8' }}
    >
      ADMIN
    </span>
  )
}

function StreakFlame({ count }: { count: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 text-caption font-extrabold leading-none"
      style={{ color: '#FFB259' }}
    >
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor" aria-hidden="true">
        <path d="M13.5.67s.74 2.65.74 4.8a3.74 3.74 0 0 1-3.74 3.73 3.73 3.73 0 0 1-3.73-3.73l.03-.36A8.97 8.97 0 0 0 4 14a8 8 0 1 0 16 0c0-5.39-2.59-10.2-6.5-13.33z" />
      </svg>
      {count}
    </span>
  )
}

function PositionDelta({ change }: { change: number }) {
  if (change > 0) {
    return (
      <span className="text-2xs font-bold leading-none" style={{ color: '#5BE0A0' }}>
        ▲{change}
      </span>
    )
  }
  if (change < 0) {
    return (
      <span className="text-2xs font-bold leading-none" style={{ color: '#FF7A8A' }}>
        ▼{Math.abs(change)}
      </span>
    )
  }
  return <span className="text-2xs font-bold leading-none text-white/35">—</span>
}

export default function LeaderboardBoard({
  entries,
  currentUserId,
  hasFinishedMatches = true,
  positionChangeByUser,
}: LeaderboardBoardProps) {
  return (
    <div
      className={`${jakarta.className} mx-auto w-full max-w-105 rounded-panel border border-white/5 p-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.75)]`}
      style={{ background: 'linear-gradient(160deg, #14263F 0%, #0D1A2D 100%)' }}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[20px] font-extrabold leading-none text-white">Tabla</h2>
        <span className="text-2xs font-semibold text-white/55">{entries.length} participantes</span>
      </div>

      {!hasFinishedMatches && (
        <p className="mt-1.5 px-1 text-2xs text-white/55">
          Aun no hay partidos finalizados para puntuar la liga.
        </p>
      )}

      <div className="mt-2.5 flex flex-col gap-1.5">
        {entries.map((entry, index) => {
          const rank = index + 1
          const isMine = entry.userId === currentUserId
          const { current, possible } = pointsProgress(entry)
          const { exactPct, outcomePct, missPct } = hitBreakdown(entry)
          const streak = entry.streak ?? 0
          const medal = rank <= 3 ? MEDALS[rank as Rank] : null
          const change = positionChangeByUser?.[entry.userId]

          return (
            <div
              key={entry.userId}
              className="flex items-center gap-2.5 rounded-2xl px-3 py-2"
              style={{
                background: 'linear-gradient(135deg, #3F82CC, #2B5790)',
                ...(isMine ? { boxShadow: '0 0 0 2px #59E0A0' } : {}),
              }}
            >
              <div className="flex w-6 shrink-0 flex-col items-center gap-0.5">
                {medal ? (
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-extrabold"
                    style={{ background: `linear-gradient(160deg, ${medal.from}, ${medal.to})`, color: medal.text }}
                  >
                    {rank}
                  </span>
                ) : (
                  <span className="text-[13px] font-extrabold text-white/40">{rank}</span>
                )}
                {change !== undefined && <PositionDelta change={change} />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[13.5px] font-bold text-white">{entry.name ?? '—'}</p>
                  {entry.role === 'admin' && <AdminChip />}
                  {isMine && <TuChip />}
                  {streak >= 3 && <StreakFlame count={streak} />}
                </div>

                <p className="mt-0.5 truncate text-2xs text-white/65">
                  {entry.exactHits} exactos · {entry.winnerHits} ganador · {entry.drawHits} emp
                </p>

                <div className="mt-1 flex items-center gap-1.5">
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-white/12">
                    {exactPct > 0 && (
                      <div className="h-full shrink-0" style={{ width: `${exactPct}%`, background: '#5BE0A0' }} />
                    )}
                    {outcomePct > 0 && (
                      <div className="h-full shrink-0" style={{ width: `${outcomePct}%`, background: '#FFB259' }} />
                    )}
                    {missPct > 0 && (
                      <div className="h-full shrink-0" style={{ width: `${missPct}%`, background: '#FF7A8A' }} />
                    )}
                  </div>
                  <span className="min-w-11 shrink-0 text-right text-2xs font-bold tabular-nums text-white/55">
                    {possible > 0 ? `${current}/${possible} pts` : '—'}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-[22px] font-extrabold leading-none text-white">{entry.points}</p>
                <p className="text-2xs font-bold text-white/45">pts</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
