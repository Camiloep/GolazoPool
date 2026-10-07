'use client'

import { useState } from 'react'

interface Props {
  lines: string[]
}

export default function PredictionInfoSummary({ lines }: Props) {
  const [isExpanded, setIsExpanded] = useState(false)
  const compactText = lines.join(' ')

  return (
    <>
      <div className="mt-2 space-y-2 sm:hidden">
        <p className={`text-sm text-muted ${isExpanded ? '' : 'line-clamp-3'}`}>{compactText}</p>
        <button
          className="brand-link text-xs font-bold"
          onClick={() => setIsExpanded((current) => !current)}
          type="button"
        >
          {isExpanded ? 'Ver menos' : 'Ver mas'}
        </button>
      </div>

      <div className="mt-2 hidden space-y-1 sm:block">
        {lines.map((line) => (
          <p key={line} className="text-sm text-muted">
            {line}
          </p>
        ))}
      </div>
    </>
  )
}
