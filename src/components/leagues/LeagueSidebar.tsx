'use client'

import { useMobileNav } from '@/lib/mobile-nav-context'
import Link from 'next/link'
import { useSelectedLayoutSegment } from 'next/navigation'
import { useEffect, useState } from 'react'

interface LeagueItem {
  id: string
  name: string
  role: string
}

interface NextMatch {
  id: string
  startsAt: string
  homeTeam: { name: string; flag_emoji: string } | null
  awayTeam: { name: string; flag_emoji: string } | null
}

interface MyPosition {
  rank: number
  points: number
  total: number
}

interface Props {
  isAdmin: boolean
  isSuperAdmin: boolean
  leagueId: string
  leagueName: string
  inviteUrl: string
  allLeagues: LeagueItem[]
  myPosition: MyPosition | null
  nextMatch: NextMatch | null
}

export default function LeagueSidebar({
  isAdmin,
  isSuperAdmin,
  leagueId,
  leagueName,
  inviteUrl,
  allLeagues,
  myPosition,
  nextMatch,
}: Props) {
  const segment = useSelectedLayoutSegment()
  const { setMobileNav } = useMobileNav()
  const [copied, setCopied] = useState(false)

  const navItems = [
    {
      href: `/leagues/${leagueId}`,
      isActive: segment === null,
      label: 'Resumen',
    },
    {
      href: `/leagues/${leagueId}/predictions`,
      isActive: segment === 'predictions',
      label: 'Pronosticos',
    },
    {
      href: `/leagues/${leagueId}/bracket`,
      isActive: segment === 'bracket',
      label: 'Llave',
    },
    {
      href: `/leagues/${leagueId}/standings`,
      isActive: segment === 'standings',
      label: 'Posiciones',
    },
    ...(isAdmin
      ? [
          {
            href: `/leagues/${leagueId}/admin`,
            isActive: segment === 'admin',
            label: 'Administracion',
          },
        ]
      : []),
    ...(isSuperAdmin
      ? [
          {
            href: `/leagues/${leagueId}/results`,
            isActive: segment === 'results',
            label: 'Resultados',
          },
        ]
      : []),
  ]

  useEffect(() => {
    setMobileNav(navItems, leagueName)
    return () => setMobileNav([], '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, leagueName, segment, isAdmin, isSuperAdmin])

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const nextMatchDate = nextMatch
    ? new Date(nextMatch.startsAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    : null
  const nextMatchTime = nextMatch
    ? new Date(nextMatch.startsAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <aside>
      <div className="hidden lg:fixed lg:bottom-0 lg:left-0 lg:top-20 lg:flex lg:w-68 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-brand-line lg:bg-white/40 dark:lg:bg-[#0d1b2a]/90 lg:backdrop-blur-xl">
        <div className="flex flex-1 flex-col gap-3 p-3">
          <div className="brand-panel rounded-panel p-3">
            <p className="brand-kicker mb-2 px-1 text-kicker-xs tracking-brand-wide">Mis ligas</p>
            <div className="flex flex-col gap-1">
              {allLeagues.map((lg) => (
                <Link
                  key={lg.id}
                  href={`/leagues/${lg.id}`}
                  className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition ${
                    lg.id === leagueId
                      ? 'brand-button-primary text-white'
                      : 'brand-button-ghost text-foreground'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-2xs font-black ${
                      lg.id === leagueId ? 'bg-white/18 text-white' : 'brand-chip-member'
                    }`}
                  >
                    {lg.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate">{lg.name}</span>
                  {lg.role === 'admin' && (
                    <span
                      className={`ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-3xs font-bold ${
                        lg.id === leagueId ? 'bg-white/18 text-white/90' : 'brand-chip-admin'
                      }`}
                    >
                      Admin
                    </span>
                  )}
                </Link>
              ))}
            </div>
            <Link
              href="/dashboard"
              className="brand-link mt-2 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold"
            >
              <span className="text-base leading-none">+</span>
              Ver todas / Crear liga
            </Link>
          </div>

          <nav className="brand-panel rounded-panel p-2">
            <p className="brand-kicker mb-1 px-2 text-kicker-xs tracking-brand-wide">{leagueName}</p>
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                    item.isActive
                      ? 'brand-button-primary text-white'
                      : 'brand-button-ghost text-foreground'
                  }`}
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>

          {myPosition && (
            <div className="brand-panel rounded-panel p-4">
              <p className="brand-kicker mb-2 px-1 text-kicker-xs tracking-brand-wide">Mi posicion</p>
              <div className="flex items-center gap-3 px-1">
                <span className="brand-display text-3xl font-black text-foreground">#{myPosition.rank}</span>
                <div className="text-xs text-muted">
                  <p className="font-semibold text-foreground">{myPosition.points} pts</p>
                  <p>de {myPosition.total} participantes</p>
                </div>
              </div>
            </div>
          )}

          {isAdmin && (
            <button
              onClick={handleCopy}
              type="button"
              className="brand-button-secondary rounded-panel px-3 py-3 text-sm font-semibold text-foreground"
            >
              {copied ? 'Enlace copiado' : 'Copiar enlace de invitacion'}
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
