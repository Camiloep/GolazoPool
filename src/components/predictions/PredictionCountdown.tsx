'use client'

import { useCountdown } from '@/hooks/use-countdown'

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl bg-brand-panel px-1 py-1.5">
      <span className="text-sm font-black tabular-nums leading-none text-foreground">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-3xs text-muted">{label}</span>
    </div>
  )
}

export function PredictionCountdown({ lockAtMs }: { lockAtMs: number }) {
  const countdown = useCountdown(new Date(lockAtMs))

  if (!countdown || countdown.total <= 0) return null

  return (
    <div className="mt-2 rounded-2xl border border-brand-line bg-brand-surface px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-2xs font-semibold text-muted">Resultados se bloquean en:</span>
      </div>
      <div className="flex gap-1.5">
        <TimeUnit value={countdown.days} label="días" />
        <TimeUnit value={countdown.hours} label="hrs" />
        <TimeUnit value={countdown.minutes} label="min" />
        <TimeUnit value={countdown.seconds} label="seg" />
      </div>
    </div>
  )
}
