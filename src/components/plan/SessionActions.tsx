'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Session {
  id: string
  status: string
  actual_duration_min: number | null
  actual_rpe: number | null
  actual_notes: string | null
  duration_min: number
}

export function SessionActions({ session }: { session: Session }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(session.status === 'done')
  const [actualDuration, setActualDuration] = useState(
    session.actual_duration_min ?? session.duration_min
  )
  const [actualRpe, setActualRpe] = useState(session.actual_rpe ?? '')
  const [notes, setNotes] = useState(session.actual_notes ?? '')

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

  async function markDone() {
    await updateSession({
      status: 'done',
      actual_duration_min: actualDuration,
      actual_rpe: actualRpe ? Number(actualRpe) : null,
      actual_notes: notes || null,
      completed_at: new Date().toISOString(),
    })
    toast.success('Séance complétée ! Bravo 💪')
  }

  async function markSkipped() {
    await updateSession({ status: 'skipped' })
    toast.info('Séance marquée comme passée')
  }

  if (session.status === 'done') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-green-800">✅ Séance complétée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-green-700">
          {session.actual_duration_min && (
            <p>Durée réelle : <strong>{session.actual_duration_min} min</strong></p>
          )}
          {session.actual_rpe && (
            <p>RPE ressenti : <strong>{session.actual_rpe}/10</strong></p>
          )}
          {session.actual_notes && (
            <p className="italic">"{session.actual_notes}"</p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (session.status === 'skipped') {
    return (
      <Card className="border-zinc-200">
        <CardContent className="py-4 text-center text-zinc-500 text-sm">
          Séance passée
          <button
            className="ml-2 underline text-zinc-700"
            onClick={() => updateSession({ status: 'planned' })}
          >
            Remettre en planifiée
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {showFeedback && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Feedback post-séance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Durée réelle (min)</Label>
                <Input
                  type="number"
                  value={actualDuration}
                  onChange={e => setActualDuration(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>RPE ressenti (1–10)</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={actualRpe}
                  onChange={e => setActualRpe(e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optionnel)</Label>
              <Textarea
                placeholder="Comment s'est passée la séance ?"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        {!showFeedback ? (
          <Button className="flex-1" onClick={() => setShowFeedback(true)}>
            ✅ Marquer comme complétée
          </Button>
        ) : (
          <Button className="flex-1" onClick={markDone} disabled={loading}>
            {loading ? 'Enregistrement…' : '✅ Valider la séance'}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={markSkipped}
          disabled={loading}
        >
          Séance passée
        </Button>
      </div>
    </div>
  )
}
