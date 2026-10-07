'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface MobileNavItem {
  href: string
  label: string
  isActive: boolean
}

interface MobileNavContextValue {
  navItems: MobileNavItem[]
  leagueName: string
  setMobileNav: (items: MobileNavItem[], leagueName: string) => void
  isOpen: boolean
  setIsOpen: (open: boolean | ((prev: boolean) => boolean)) => void
}

const MobileNavContext = createContext<MobileNavContextValue>({
  navItems: [],
  leagueName: '',
  setMobileNav: () => {},
  isOpen: false,
  setIsOpen: () => {},
})

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [navItems, setNavItems] = useState<MobileNavItem[]>([])
  const [leagueName, setLeagueName] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const setMobileNav = useCallback((items: MobileNavItem[], name: string) => {
    setNavItems(items)
    setLeagueName(name)
  }, [])

  return (
    <MobileNavContext.Provider value={{ navItems, leagueName, setMobileNav, isOpen, setIsOpen }}>
      {children}
    </MobileNavContext.Provider>
  )
}

export function useMobileNav() {
  return useContext(MobileNavContext)
}
