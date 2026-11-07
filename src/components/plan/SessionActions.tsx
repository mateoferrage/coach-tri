'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface Session {
  id: string
  status: string
}

export function SessionActions({ session }: { session: Session }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function updateSession(updates: Record<string, unknown>) {
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Erreur')
      }
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  if (session.status === 'skipped') {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        Séance sautée
        <Button
          variant="link"
          size="sm"
          className="px-0 text-foreground underline"
          onClick={() => updateSession({ status: 'planned' })}
          disabled={loading}
        >
          Remettre en planifiée
        </Button>
      </div>
    )
  }

  if (session.status !== 'done') {
    return (
      <Button
        variant="outline"
        className="w-full"
        onClick={() => updateSession({ status: 'skipped' })}
        disabled={loading}
      >
        Séance sautée
      </Button>
    )
  }

  return null
}
