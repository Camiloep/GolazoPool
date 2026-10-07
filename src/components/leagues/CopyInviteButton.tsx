'use client'

import { useState } from 'react'

export default function CopyInviteButton({
  code,
  url,
  compact = false,
}: {
  code: string
  url: string
  compact?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (compact) {
    return (
      <button
        className="brand-button-secondary flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold active:scale-95"
        onClick={handleCopy}
        type="button"
      >
        {copied ? 'Copiado' : 'Copiar enlace'}
      </button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <p className="text-xs text-muted">
        Codigo: <span className="font-mono font-black text-foreground">{code}</span>
      </p>
      <button
        className="brand-button-secondary flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold active:scale-95"
        onClick={handleCopy}
        type="button"
      >
        {copied ? 'Copiado' : 'Copiar invitacion'}
      </button>
    </div>
  )
}
