import Link from 'next/link'

export default function DataUseNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-brand-blue/4 px-3 py-2 text-xs leading-relaxed text-muted">
      {children}{' '}
      <Link className="brand-link" href="/privacy">
        Politica de privacidad y tratamiento de datos
      </Link>
      .
    </p>
  )
}
