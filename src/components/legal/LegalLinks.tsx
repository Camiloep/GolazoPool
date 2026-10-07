import Link from 'next/link'

export default function LegalLinks({ className = '' }: { className?: string }) {
  const classes = ['flex items-center justify-center gap-2 text-xs text-muted', className]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes}>
      <Link className="brand-link text-xs" href="/privacy">
        Privacidad y cookies
      </Link>
    </div>
  )
}
