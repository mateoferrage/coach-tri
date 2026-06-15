'use client'

import { useEffect } from 'react'
import { ACCENT, ACCENT_FG, TEXT_FAINT, TEXT_MUTED } from '@/lib/theme'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Remonte l'erreur dans la console (et les logs serveur via le digest)
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
          Une erreur est survenue
        </p>
        <h1 className="text-2xl font-black">Quelque chose s&apos;est mal passé</h1>
        <p className="max-w-md text-sm" style={{ color: TEXT_MUTED }}>
          Cette page n&apos;a pas pu se charger. Réessaie — si le problème persiste, reviens plus
          tard.
        </p>
      </div>
      <button
        onClick={reset}
        className="rounded-xl px-5 py-2.5 text-sm font-bold"
        style={{ backgroundColor: ACCENT, color: ACCENT_FG }}
      >
        Réessayer
      </button>
    </div>
  )
}
