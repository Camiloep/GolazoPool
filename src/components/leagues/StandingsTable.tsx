/* eslint-disable @next/next/no-img-element */
import { flagUrl } from '@/lib/flags'
import {
  ADVANCING_THIRD_PLACES,
  type FormResult,
  type GroupStandings,
  type TeamStanding,
  type ThirdPlaceRow,
} from '@/lib/standings'

const FORM_STYLE: Record<FormResult, string> = {
  G: 'bg-emerald-500/85 text-white',
  E: 'bg-amber-500/85 text-white',
  P: 'bg-red-500/85 text-white',
  '?': 'bg-white/10 text-muted',
}

function FormChips({ form }: { form: FormResult[] }) {
  if (form.length === 0) return <span className="text-2xs text-muted">—</span>
  return (
    <div className="flex items-center justify-end gap-1">
      {form.slice(-5).map((result, index) => (
        <span
          key={index}
          className={`inline-flex h-4.5 w-4.5 items-center justify-center rounded text-3xs font-bold ${FORM_STYLE[result]}`}
        >
          {result === '?' ? '·' : result}
        </span>
      ))}
    </div>
  )
}

function LivePill({ live }: { live: { for: number; against: number } }) {
  const tone =
    live.for > live.against
      ? 'bg-emerald-500'
      : live.for === live.against
        ? 'bg-amber-500'
        : 'bg-red-500'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-black tabular-nums text-white ${tone}`}
      title="En vivo"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/90" />
      {live.for}-{live.against}
    </span>
  )
}

function PositionBadge({ position, classified }: { position: number; classified: boolean }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-2xs font-bold"
      style={
        classified
          ? { background: '#3F82CC', color: '#fff' }
          : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }
      }
    >
      {position}
    </span>
  )
}

function HeaderRow() {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-3xs font-bold tracking-wide text-muted">
      <span className="w-6 shrink-0 text-center">#</span>
      <span className="flex-1">Equipo</span>
      <span className="w-6 shrink-0 text-center">PJ</span>
      <span className="hidden w-6 shrink-0 text-center sm:block">G</span>
      <span className="hidden w-6 shrink-0 text-center sm:block">E</span>
      <span className="hidden w-6 shrink-0 text-center sm:block">P</span>
      <span className="hidden w-12 shrink-0 text-center sm:block">Goles</span>
      <span className="w-8 shrink-0 text-center">DG</span>
      <span className="w-7 shrink-0 text-center">Pts</span>
      <span className="hidden w-24 shrink-0 text-right sm:block">Forma</span>
    </div>
  )
}

function StandingRow({
  row,
  position,
  classified,
}: {
  row: TeamStanding
  position: number
  classified: boolean
}) {
  const url = row.code ? flagUrl(row.code) : null
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-2 odd:bg-white/2">
      <PositionBadge position={position} classified={classified} />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {url ? (
          <img alt={row.name} className="h-4 w-6 shrink-0 rounded-xs object-cover" src={url} />
        ) : (
          <span className="h-4 w-6 shrink-0 rounded-xs bg-white/10" />
        )}
        <span className="min-w-0 truncate text-sm font-semibold text-foreground">{row.name}</span>
        {row.live && <LivePill live={row.live} />}
      </div>
      <span className="w-6 shrink-0 text-center text-sm tabular-nums text-muted">{row.pj}</span>
      <span className="hidden w-6 shrink-0 text-center text-sm tabular-nums text-muted sm:block">{row.w}</span>
      <span className="hidden w-6 shrink-0 text-center text-sm tabular-nums text-muted sm:block">{row.d}</span>
      <span className="hidden w-6 shrink-0 text-center text-sm tabular-nums text-muted sm:block">{row.l}</span>
      <span className="hidden w-12 shrink-0 text-center text-sm tabular-nums text-muted sm:block">
        {row.gf}:{row.ga}
      </span>
      <span className="w-8 shrink-0 text-center text-sm tabular-nums text-muted">
        {row.gd > 0 ? `+${row.gd}` : row.gd}
      </span>
      <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-foreground">{row.pts}</span>
      <span className="hidden w-24 shrink-0 sm:block">
        <FormChips form={row.form} />
      </span>
    </div>
  )
}

export default function StandingsTable({
  groups,
  thirdsRanking,
}: {
  groups: GroupStandings[]
  thirdsRanking: ThirdPlaceRow[]
}) {
  const classifiedThirdGroups = new Set(
    thirdsRanking.filter(row => row.classified).map(row => row.group)
  )

  return (
    <div className="space-y-5">
      {groups.map(group => (
        <section key={group.group} className="brand-card rounded-2xl p-2.5">
          <div className="flex items-center justify-between px-2 pt-1">
            <h3 className="brand-display text-base font-black text-foreground">Grupo {group.group}</h3>
          </div>
          <HeaderRow />
          <div className="flex flex-col">
            {group.rows.map((row, index) => (
              <StandingRow
                key={row.teamId}
                row={row}
                position={index + 1}
                classified={index < 2 || (index === 2 && classifiedThirdGroups.has(group.group))}
              />
            ))}
          </div>
        </section>
      ))}

      {thirdsRanking.length > 0 && (
        <section className="brand-card rounded-2xl p-2.5">
          <div className="px-2 pt-1">
            <h3 className="brand-display text-base font-black text-foreground">Mejores terceros</h3>
            <p className="text-2xs text-muted">Los {ADVANCING_THIRD_PLACES} primeros avanzan a Dieciseisavos.</p>
          </div>
          <HeaderRow />
          <div className="flex flex-col">
            {thirdsRanking.map((row, index) => (
              <StandingRow key={row.teamId} row={row} position={index + 1} classified={row.classified} />
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-2xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded" style={{ background: '#3F82CC' }} /> Clasificado a Dieciseisavos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-white/10" /> Eliminado / fuera de cupo
        </span>
        <span className="flex items-center gap-2">
          Forma:
          <span className="flex items-center gap-1">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-emerald-500/85 text-3xs font-bold text-white">G</span>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-amber-500/85 text-3xs font-bold text-white">E</span>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-red-500/85 text-3xs font-bold text-white">P</span>
          </span>
        </span>
      </div>
    </div>
  )
}
