'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

// Burst-collapse window: the cron writes several rows in quick succession
// (one per live match), which should produce a single page refresh.
const REFRESH_DEBOUNCE_MS = 1500

// Unique channel topic per subscription. Reusing a fixed topic on the
// singleton browser client can return the previous page's still-leaving
// channel, whose subscribe() is a silent no-op — the new page would never
// receive events.
let channelSeq = 0

// Subscribes to Supabase Realtime changes on the live-match tables and
// re-renders the current server page when anything changes. Mounting it on a
// page makes live scores/phases appear without manual reloads. When no match
// is being updated there are no events, so the idle cost is one quiet channel.
export function LiveMatchRefresher() {
  const router = useRouter()
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    const scheduleRefresh = () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        router.refresh()
      }, REFRESH_DEBOUNCE_MS)
    }

    // setAuth() BEFORE subscribing: on a cold page load the join frame is
    // built synchronously, before the user's JWT finishes loading, and the
    // subscription silently falls back to anon claims — RLS then filters out
    // every event while the channel still reports SUBSCRIBED.
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      channelSeq += 1
      channel = supabase
        .channel(`live-matches-${channelSeq}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'match_live_states' },
          scheduleRefresh
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'matches' },
          scheduleRefresh
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      if (channel) supabase.removeChannel(channel)
    }
  }, [router])

  return null
}
