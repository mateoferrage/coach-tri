'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

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
        <p className="text-sm font-medium text-muted-foreground">Une erreur est survenue</p>
        <h1 className="text-3xl md:text-4xl">Quelque chose s&apos;est mal passé</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Cette page n&apos;a pas pu se charger. Réessaie — si le problème persiste, reviens plus
          tard.
        </p>
      </div>
      <Button variant="highlight" onClick={reset}>
        Réessayer
      </Button>
    </div>
  )
}
