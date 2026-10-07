'use client'

import { useEffect, useState } from 'react'

// Mirrors FS_STAGE in src/server/flashscore/html-scraper.ts (client components
// cannot import server-only modules).
const STAGE = {
  FIRST_HALF: 12,
  HALF_TIME: 38,
  SECOND_HALF: 13,
  FINISHED: 3,
  FINISHED_AET: 10,
  FINISHED_PENS: 11,
  EXTRA_TIME: 6,
  PENALTIES: 7,
  BREAK_TIME: 46,
  INTERRUPTED: 36,
  POSTPONED: 37,
  CANCELLED: 5,
  ABANDONED: 8,
  WALKOVER: 9,
} as const

type Tone = 'live' | 'half' | 'extra' | 'pens' | 'finished' | 'stopped' | 'neutral'

const TONE_CLASSES: Record<Tone, string> = {
  live: 'bg-[rgba(220,38,38,0.1)] text-red-600 dark:bg-[rgba(248,113,113,0.14)] dark:text-red-400',
  half: 'bg-[rgba(217,119,6,0.12)] text-amber-600 dark:bg-[rgba(251,191,36,0.14)] dark:text-amber-400',
  extra: 'bg-[rgba(124,58,237,0.12)] text-violet-600 dark:bg-[rgba(167,139,250,0.16)] dark:text-violet-300',
  pens: 'bg-[rgba(13,148,136,0.12)] text-teal-600 dark:bg-[rgba(45,212,191,0.14)] dark:text-teal-300',
  // Finalizado (normal, tras prórroga o penales): mismo azul solido que los otros
  // marcadores (brand-score-pill), para que el marcador final se vea igual sin
  // importar si hubo prórroga/penales.
  finished: 'brand-score-pill',
  stopped: 'bg-[rgba(220,38,38,0.1)] text-red-600 dark:bg-[rgba(248,113,113,0.12)] dark:text-red-400',
  neutral: 'bg-brand-panel text-muted',
}

const DOT_CLASSES: Record<Tone, string> = {
  live: 'bg-red-500',
  half: 'bg-amber-500',
  extra: 'bg-violet-500',
  pens: 'bg-teal-400',
  finished: 'bg-emerald-500',
  stopped: 'bg-red-500',
  neutral: 'bg-slate-400',
}

// Stoppage display caps: with stale data the elapsed clock keeps growing, so
// extra minutes are clamped to a plausible ceiling.
const MAX_STOPPAGE = 15

function displayMinute(stageCode: number | null, stageStartedAtMs: number | null): string | null {
  if (!stageStartedAtMs) return null
  const elapsed = Math.floor((Date.now() - stageStartedAtMs) / 60_000) + 1
  if (elapsed < 1) return null

  if (stageCode === STAGE.FIRST_HALF) {
    if (elapsed <= 45) return `${elapsed}'`
    return `45+${Math.min(elapsed - 45, MAX_STOPPAGE)}'`
  }
  if (stageCode === STAGE.SECOND_HALF) {
    const minute = 45 + elapsed
    if (minute <= 90) return `${minute}'`
    return `90+${Math.min(minute - 90, MAX_STOPPAGE)}'`
  }
  // Prórroga: un solo código (6) cubre ambos tiempos y DD se queda en el inicio
  // de la prórroga (el minuto 90'), asi que el reloj es continuo 91'→120'. La
  // pausa entre tiempos de prórroga no resetea DD, por lo que el conteo sigue.
  if (stageCode === STAGE.EXTRA_TIME) {
    const minute = 90 + elapsed
    if (minute <= 120) return `${minute}'`
    return `120+${Math.min(minute - 120, MAX_STOPPAGE)}'`
  }
  return null
}

function resolveDisplay(
  status: string,
  phase: string | null,
  stageCode: number | null
): { label: string; tone: Tone; dot: boolean; withScore: boolean; ticks: boolean } {
  if (status === 'finished') {
    if (stageCode === STAGE.FINISHED_AET)
      return { label: 'Final · Prórroga', tone: 'finished', dot: false, withScore: true, ticks: false }
    if (stageCode === STAGE.FINISHED_PENS)
      return { label: 'Tras la prórroga', tone: 'finished', dot: false, withScore: true, ticks: false }
    return { label: 'Finalizado', tone: 'finished', dot: false, withScore: true, ticks: false }
  }

  if (status === 'scheduled') {
    return { label: 'Por jugar', tone: 'neutral', dot: false, withScore: false, ticks: false }
  }

  switch (stageCode) {
    case STAGE.FIRST_HALF:
      return { label: '1er tiempo', tone: 'live', dot: true, withScore: true, ticks: true }
    case STAGE.HALF_TIME:
      return { label: 'Descanso', tone: 'half', dot: false, withScore: true, ticks: false }
    case STAGE.SECOND_HALF:
      return { label: '2do tiempo', tone: 'live', dot: true, withScore: true, ticks: true }
    case STAGE.EXTRA_TIME:
      return { label: 'Prórroga', tone: 'extra', dot: true, withScore: true, ticks: true }
    case STAGE.PENALTIES:
      return { label: 'Tras la prórroga', tone: 'pens', dot: true, withScore: true, ticks: false }
    case STAGE.BREAK_TIME:
      return { label: 'Descanso', tone: 'half', dot: false, withScore: true, ticks: false }
    case STAGE.INTERRUPTED:
      return { label: 'Interrumpido', tone: 'stopped', dot: false, withScore: true, ticks: false }
    case STAGE.ABANDONED:
      return { label: 'Suspendido', tone: 'stopped', dot: false, withScore: true, ticks: false }
    case STAGE.POSTPONED:
      return { label: 'Aplazado', tone: 'neutral', dot: false, withScore: false, ticks: false }
    case STAGE.CANCELLED:
      return { label: 'Cancelado', tone: 'neutral', dot: false, withScore: false, ticks: false }
    case STAGE.WALKOVER:
      return { label: 'Walkover', tone: 'neutral', dot: false, withScore: false, ticks: false }
  }

  return { label: phase ?? 'En juego', tone: 'live', dot: true, withScore: true, ticks: false }
}

export function MatchStatusStrip({
  status,
  phase,
  stageCode,
  stageStartedAtMs,
  homeScore,
  awayScore,
  etHomeScore = null,
  etAwayScore = null,
  penHomeScore = null,
  penAwayScore = null,
}: {
  status: string
  phase: string | null
  stageCode: number | null
  stageStartedAtMs: number | null
  homeScore: number | null
  awayScore: number | null
  // Marcador final TRAS prórroga (DE/DF de Flashscore). En eliminatorias que
  // fueron a tiempo extra, homeScore/awayScore es el de los 90' (que puntúa) y
  // este es el final; se muestran ambos.
  etHomeScore?: number | null
  etAwayScore?: number | null
  // Marcador de la tanda de penales (para la 2da línea "PEN: X-Y").
  penHomeScore?: number | null
  penAwayScore?: number | null
}) {
  const display = resolveDisplay(status, phase, stageCode)

  // Solo en partidos ganados en PRÓRROGA (no penales, donde el marcador de
  // Flashscore incluye un +1 al ganador) y cuando difiere del de los 90'.
  const showExtraTimeFinal =
    status === 'finished' &&
    stageCode === STAGE.FINISHED_AET &&
    etHomeScore !== null &&
    etAwayScore !== null &&
    (etHomeScore !== homeScore || etAwayScore !== awayScore)

  // Segunda línea con el marcador de la tanda, durante o tras los penales.
  const showPens =
    (stageCode === STAGE.PENALTIES || stageCode === STAGE.FINISHED_PENS) &&
    penHomeScore !== null &&
    penAwayScore !== null

  // Minute is computed only after mount (never in the initializer) so the
  // server-rendered HTML can't disagree with the client during hydration.
  const [minute, setMinute] = useState<string | null>(null)

  useEffect(() => {
    if (!display.ticks) {
      setMinute(null)
      return
    }
    setMinute(displayMinute(stageCode, stageStartedAtMs))
    const interval = setInterval(() => {
      setMinute(displayMinute(stageCode, stageStartedAtMs))
    }, 30_000)
    return () => clearInterval(interval)
  }, [display.ticks, stageCode, stageStartedAtMs])

  const showScore = display.withScore && homeScore !== null && awayScore !== null

  return (
    <span
      className={`inline-flex ${showPens ? 'flex-col' : ''} items-center gap-x-2 gap-y-0.5 rounded-full px-3 py-1 text-xs font-bold ${TONE_CLASSES[display.tone]}`}
    >
      <span className="inline-flex items-center gap-2">
        {display.dot && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${DOT_CLASSES[display.tone]}`}
            />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOT_CLASSES[display.tone]}`} />
          </span>
        )}
        <span>
          {showExtraTimeFinal ? 'Final' : display.label}
          {minute ? ` · ${minute}` : ''}
        </span>
        {showScore && (
          <>
            <span className="opacity-40">|</span>
            {showExtraTimeFinal ? (
              <span className="tabular-nums">
                <span className="opacity-60">90&apos;</span>{' '}
                <span className="font-black">
                  {homeScore}–{awayScore}
                </span>
                <span className="opacity-60"> · prórroga </span>
                <span className="font-black">
                  {etHomeScore}–{etAwayScore}
                </span>
              </span>
            ) : (
              <span className="font-black tabular-nums">
                {homeScore} – {awayScore}
              </span>
            )}
          </>
        )}
      </span>
      {showPens && (
        <span className="text-2xs font-bold tabular-nums opacity-90">
          PEN: {penHomeScore} – {penAwayScore}
        </span>
      )}
    </span>
  )
}
