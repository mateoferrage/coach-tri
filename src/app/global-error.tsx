'use client'

import { useEffect } from 'react'

// Capture les erreurs du root layout lui-même. Doit fournir ses propres <html>/<body>.
// Styles inline uniquement : les variables de police/thème ne sont pas garanties ici.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          background: 'oklch(0.952 0.009 188.1)',
          color: 'oklch(0.287 0.047 217.9)',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>
          Quelque chose s&apos;est mal passé
        </h1>
        <p style={{ color: 'oklch(0.504 0.038 203.1)', maxWidth: '28rem', margin: 0 }}>
          L&apos;application a rencontré une erreur inattendue.
        </p>
        <button
          onClick={reset}
          style={{
            border: 'none',
            borderRadius: '0.75rem',
            padding: '0.625rem 1.25rem',
            fontWeight: 700,
            cursor: 'pointer',
            background: 'oklch(0.306 0.051 209.3)',
            color: 'oklch(1 0 0)',
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  )
}
