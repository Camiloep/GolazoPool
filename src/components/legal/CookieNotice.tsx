'use client'

import Link from 'next/link'
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'golazopool.cookies-notice.v1'
const STORAGE_EVENT = 'golazopool:cookies-notice'

function subscribe(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  function handleStorage(event: Event) {
    if (event instanceof StorageEvent && event.key && event.key !== STORAGE_KEY) return
    onStoreChange()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(STORAGE_EVENT, handleStorage)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(STORAGE_EVENT, handleStorage)
  }
}

function getSnapshot() {
  if (typeof window === 'undefined') return false

  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'accepted'
  } catch {
    return false
  }
}

export default function CookieNotice() {
  const hasAccepted = useSyncExternalStore(subscribe, getSnapshot, () => false)

  function acknowledge() {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'accepted')
    } catch {
      // If storage is blocked, still allow the user to dismiss the notice for this session.
    }

    window.dispatchEvent(new Event(STORAGE_EVENT))
  }

  if (hasAccepted) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6">
      <div className="pointer-events-auto mx-auto max-w-4xl brand-panel rounded-panel border border-brand-line-strong px-5 py-4 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl text-left">
            <p className="brand-kicker text-kicker-sm tracking-brand-wide">Uso de cookies</p>
            <p className="mt-2 text-sm text-muted">
              Usamos cookies tecnicas para iniciar sesion y mantener la cuenta activa. Tambien
              registramos analitica basica de uso. Puedes revisar el detalle en la{' '}
              <Link className="brand-link" href="/privacy">
                Politica de privacidad y cookies
              </Link>
              .
            </p>
          </div>
          <button
            className="brand-button-primary rounded-2xl px-5 py-3 text-sm font-semibold"
            onClick={acknowledge}
            type="button"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
