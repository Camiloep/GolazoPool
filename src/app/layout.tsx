import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Montserrat, Open_Sans } from 'next/font/google'
import Script from 'next/script'

import AppAnalytics from '@/components/analytics/AppAnalytics'
import CookieNotice from '@/components/legal/CookieNotice'
import DevtoolsWarning from '@/components/layout/DevtoolsWarning'
import { ThemeProvider } from '@/lib/theme-context'
import './globals.css'

const brandDisplay = Montserrat({
  variable: '--font-brand-display',
  subsets: ['latin'],
  display: 'swap',
})

const brandBody = Open_Sans({
  variable: '--font-brand-body',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  applicationName: 'GolazoPool',
  title: {
    default: 'GolazoPool',
    template: '%s | GolazoPool',
  },
  description:
    'Plataforma de pronosticos deportivos para el Mundial de Futbol FIFA 2026.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'GolazoPool',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#004A99',
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`${brandDisplay.variable} ${brandBody.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head />
      <body className="min-h-full flex flex-col font-sans">
        <Script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.setAttribute('data-theme',t||'dark')}catch(e){}})()`,
          }}
          id="theme-init"
          strategy="beforeInteractive"
        />
        <ThemeProvider>
          {children}
          <CookieNotice />
          <AppAnalytics />
          <DevtoolsWarning />
        </ThemeProvider>
      </body>
    </html>
  )
}
