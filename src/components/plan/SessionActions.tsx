'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
      <Card className="border-border">
        <CardContent className="py-4 text-center text-muted-foreground text-sm">
          Séance passée
          <button
            className="ml-2 underline text-foreground disabled:opacity-50"
            onClick={() => updateSession({ status: 'planned' })}
            disabled={loading}
          >
            Remettre en planifiée
          </button>
        </CardContent>
      </Card>
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
        Séance passée
      </Button>
    )
  }

  return null
}
