import Link from 'next/link'
import BrandMark from '@/components/layout/BrandMark'
import LegalLinks from '@/components/legal/LegalLinks'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isSignedIn = Boolean(user)
  const headerHref = isSignedIn ? '/dashboard' : '/login'
  const primaryHref = isSignedIn ? '/dashboard' : '/login'
  const secondaryHref = isSignedIn ? '/leagues/new' : '/login'

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-brand-line bg-white/70 dark:bg-[#0d1b2a]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="flex h-20 items-center justify-between">
          <BrandMark size="sm" />
          <Link
            href={headerHref}
            className="brand-button-secondary rounded-xl px-3 py-2 text-xs font-semibold"
          >
            {isSignedIn ? 'Ir al dashboard' : 'Iniciar sesion'}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
        <div className="brand-panel w-full max-w-4xl rounded-4xl px-6 py-12 sm:px-10">
          <BrandMark align="center" size="lg" />
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
            Compite con amigos pronosticando los resultados del Mundial FIFA 2026. Crea tu liga,
            invita a tu grupo y demuestra quien sabe mas de futbol.
          </p>

          <div className="mt-10 flex justify-center gap-3">
            <Link
              href={primaryHref}
              className="brand-button-primary rounded-2xl px-8 py-3.5 text-sm font-semibold"
            >
              {isSignedIn ? 'Ir a mis ligas' : 'Empezar ahora'}
            </Link>
            {isSignedIn && (
              <Link
                href={secondaryHref}
                className="brand-button-secondary rounded-2xl px-8 py-3.5 text-sm font-semibold"
              >
                Crear liga
              </Link>
            )}
          </div>
        </div>
      </main>

      <section className="border-t border-brand-line bg-white/45 dark:bg-[#111f30]/60 px-5 py-16 backdrop-blur-sm sm:px-8 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="brand-card rounded-3xl p-6">
              <div className="mb-3 text-2xl">⚽</div>
              <h3 className="brand-display text-xl font-black text-foreground">Pronostica partidos</h3>
              <p className="mt-2 text-sm text-muted">
                Predice el resultado de cada partido del Mundial y acumula puntos por aciertos.
              </p>
            </div>
            <div className="brand-card rounded-3xl p-6">
              <div className="mb-3 text-2xl">🏆</div>
              <h3 className="brand-display text-xl font-black text-foreground">Crea tu liga</h3>
              <p className="mt-2 text-sm text-muted">
                Arma un grupo privado con amigos, companeros o familia y compite internamente.
              </p>
            </div>
            <div className="brand-card rounded-3xl p-6">
              <div className="mb-3 text-2xl">📊</div>
              <h3 className="brand-display text-xl font-black text-foreground">Sigue el marcador</h3>
              <p className="mt-2 text-sm text-muted">
                Consulta la tabla en tiempo real y sigue tu posicion dentro de la liga.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-brand-line px-5 py-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted">GolazoPool</p>
          <LegalLinks />
        </div>
      </footer>
    </div>
  )
}
