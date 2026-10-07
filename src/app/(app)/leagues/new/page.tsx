import { createLeague } from '@/actions/leagues'
import CreateLeagueForm from '@/components/leagues/CreateLeagueForm'
import Link from 'next/link'

export default function NewLeaguePage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-lg">
        <Link className="brand-link text-sm" href="/dashboard">
          Volver a mis ligas
        </Link>
        <h1 className="brand-display mt-4 text-4xl font-black text-foreground">Crear nueva liga</h1>
        <p className="mt-2 text-sm text-muted">
          Seras el administrador. Comparte el codigo para que otros se unan.
        </p>
        <div className="brand-panel mt-6 rounded-panel p-6">
          <CreateLeagueForm action={createLeague} />
        </div>
      </div>
    </div>
  )
}
