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
          background: '#FDFDFE',
          color: '#0B1A2A',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>
          Quelque chose s&apos;est mal passé
        </h1>
        <p style={{ color: '#4A5B6C', maxWidth: '28rem', margin: 0 }}>
          L&apos;application a rencontré une erreur inattendue.
        </p>
        <button
          onClick={reset}
          style={{
            border: 'none',
            borderRadius: '9999px',
            padding: '0.75rem 1.5rem',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            background: '#E8492A',
            color: '#FFFFFF',
          }}
        >
          Réessayer
        </button>
      </body>
    </html>
  )
}
