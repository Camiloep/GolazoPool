'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// Guards against losing unsaved form edits. Two layers:
// 1. `beforeunload` handles closing/reloading the tab or leaving the site
//    (the browser shows its own generic prompt — custom text is not allowed there).
// 2. A capture-phase click listener intercepts in-app link navigations so the
//    caller can show its own "¿Deseas guardar?" dialog before Next.js navigates.
export function useUnsavedChanges(isDirty: boolean) {
  const router = useRouter()
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const isDirtyRef = useRef(isDirty)

  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!isDirtyRef.current || event.defaultPrevented) return
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      const anchor = (event.target as Element | null)?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || anchor.hasAttribute('download')) return
      if (anchor.target && anchor.target !== '_self') return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return

      const destination = url.pathname + url.search + url.hash
      const current = window.location.pathname + window.location.search
      if (destination === current) return

      event.preventDefault()
      event.stopImmediatePropagation()
      setPendingHref(destination)
    }

    document.addEventListener('click', handleClick, { capture: true })
    return () => document.removeEventListener('click', handleClick, { capture: true })
  }, [])

  const cancel = useCallback(() => {
    setPendingHref(null)
  }, [])

  function proceed() {
    const href = pendingHref
    setPendingHref(null)
    if (href) router.push(href)
  }

  const navigateTo = useCallback(
    (href: string) => {
      router.push(href)
    },
    [router]
  )

  return { pendingHref, cancel, proceed, navigateTo }
}
