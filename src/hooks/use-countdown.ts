'use client'

import { useEffect, useState } from 'react'

interface TimeRemaining {
  total: number
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calc(target: Date): TimeRemaining {
  const total = target.getTime() - Date.now()
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const seconds = Math.floor((total / 1000) % 60)
  const minutes = Math.floor((total / 1000 / 60) % 60)
  const hours = Math.floor((total / 1000 / 60 / 60) % 24)
  const days = Math.floor(total / 1000 / 60 / 60 / 24)
  return { total, days, hours, minutes, seconds }
}

export function useCountdown(targetDate: Date | null) {
  const ms = targetDate?.getTime() ?? null

  const [remaining, setRemaining] = useState<TimeRemaining | null>(null)

  useEffect(() => {
    if (ms === null) return
    const target = new Date(ms)
    const tick = () => setRemaining(calc(target))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [ms])

  return remaining
}

export function formatCountdown(r: TimeRemaining): string {
  if (r.days > 0) return `${r.days}d ${r.hours}h`
  if (r.hours > 0) return `${r.hours}h ${r.minutes}m`
  if (r.minutes > 0) return `${r.minutes}m ${r.seconds}s`
  return `${r.seconds}s`
}
