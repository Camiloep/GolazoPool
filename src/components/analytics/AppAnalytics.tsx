'use client'

import { Analytics, type BeforeSendEvent } from '@vercel/analytics/next'

const BLOCKED_PATHS = new Set(['/verify'])
const BLOCKED_PREFIXES = ['/join/']

function normalizeTrackedPath(url: string) {
  const fallbackOrigin =
    typeof window === 'undefined' ? 'https://golazopool.local' : window.location.origin

  try {
    const parsed = new URL(url, fallbackOrigin)
    const pathname =
      parsed.pathname.length > 1 && parsed.pathname.endsWith('/')
        ? parsed.pathname.slice(0, -1)
        : parsed.pathname

    return pathname || '/'
  } catch {
    const [pathname] = url.split(/[?#]/, 1)
    return pathname || '/'
  }
}

function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const pathname = normalizeTrackedPath(event.url)

  if (BLOCKED_PATHS.has(pathname) || BLOCKED_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return null
  }

  return {
    ...event,
    url: pathname,
  }
}

export default function AppAnalytics() {
  // `debug` defaults to true in development, which floods the console with
  // "[Vercel Web Analytics]" event logs. Turn it off to keep the console clean.
  return <Analytics beforeSend={beforeSend} debug={false} />
}
