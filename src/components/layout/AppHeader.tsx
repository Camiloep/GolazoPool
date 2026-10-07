'use client'

import Link from 'next/link'
import { useMobileNav } from '@/lib/mobile-nav-context'
import type { ReactNode } from 'react'
import BrandMark from './BrandMark'
import ThemeToggle from './ThemeToggle'

interface Props {
  profileName: string
  signOutButton: ReactNode
}

export default function AppHeader({ profileName, signOutButton }: Props) {
  const { navItems, leagueName, isOpen, setIsOpen } = useMobileNav()
  const hasNav = navItems.length > 0

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-brand-line bg-white/72 dark:bg-[#0d1b2a]/88 backdrop-blur-xl">
        <div className="flex h-21 items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <Link href="/dashboard">
            <BrandMark size="sm" />
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold text-muted sm:block">
              {profileName}
            </span>
            <ThemeToggle />
            {/* Desktop */}
            <div className="hidden lg:block">{signOutButton}</div>
            {/* Mobile hamburger */}
            <button
              aria-expanded={isOpen}
              aria-label="Abrir menú"
              className="brand-button-primary flex h-10 w-10 items-center justify-center rounded-xl lg:hidden"
              onClick={() => setIsOpen((o) => !o)}
              type="button"
            >
              <div className="space-y-1.5">
                <span className={`block h-0.5 w-5 rounded bg-white transition ${isOpen ? 'translate-y-2 rotate-45' : ''}`} />
                <span className={`block h-0.5 w-5 rounded bg-white transition ${isOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-5 rounded bg-white transition ${isOpen ? '-translate-y-2 -rotate-45' : ''}`} />
              </div>
            </button>
          </div>
        </div>
      </header>

      {isOpen && (
        <>
          <button
            aria-label="Cerrar menú"
            className="fixed inset-0 top-20 z-40 bg-black/20 lg:hidden"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <div className="fixed inset-x-0 top-20 z-50 border-b border-brand-line bg-white/76 dark:bg-[#0d1b2a]/92 px-5 py-4 shadow-lg backdrop-blur-xl sm:px-8 lg:hidden">
            <div className="brand-panel space-y-3 rounded-panel p-4">
              {hasNav && (
                <>
                  <div>
                    <p className="brand-kicker text-caption tracking-brand">
                      Liga
                    </p>
                    <h2 className="brand-display mt-1 text-xl font-black text-foreground">{leagueName}</h2>
                  </div>
                  <div className="grid gap-2">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        className={`rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                          item.isActive
                            ? 'brand-button-primary text-white'
                            : 'brand-button-secondary text-foreground'
                        }`}
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-brand-line" />
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-muted">{profileName}</span>
                <div onClick={() => setIsOpen(false)}>{signOutButton}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
