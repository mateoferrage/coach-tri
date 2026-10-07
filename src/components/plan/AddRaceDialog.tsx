'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AvailableGoal {
  id: string
  race_name: string
  race_date: string
  sport?: string
}

interface AddRaceDialogProps {
  planId: string
  currentGoalIds: string[]
  primaryGoalId: string
  availableGoals: AvailableGoal[]
}

export function AddRaceDialog({
  planId,
  currentGoalIds,
  primaryGoalId,
  availableGoals,
}: AddRaceDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string>('')

  const isDisabled = availableGoals.length === 0 || currentGoalIds.length >= 3

  async function handleConfirm() {
    if (!selectedId) return
    setLoading(true)
    toast.info("Recalcul du programme par l'IA… (10-30 s)", { duration: 30000 })
    try {
      const res = await fetch(`/api/plans/${planId}/replan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal_ids: [...currentGoalIds, selectedId],
          primary_goal_id: primaryGoalId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Erreur')
        return
      }
      toast.success('Programme recalculé')
      setOpen(false)
      router.refresh()
    } catch {
      toast.error('Erreur réseau. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedId('')
    }
    setOpen(next)
  }

  return (
    <>
      <button
        onClick={() => !isDisabled && setOpen(true)}
        disabled={isDisabled}
        title={
          currentGoalIds.length >= 3
            ? 'Le programme a déjà 3 courses (maximum)'
            : availableGoals.length === 0
              ? 'Aucune course disponible à ajouter'
              : undefined
        }
        className="inline-flex items-center justify-center rounded-lg border border-border bg-card text-sm font-medium px-3 py-1.5 hover:bg-muted transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        Ajouter une course
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une course</DialogTitle>
            <DialogDescription>
              Le reste du programme sera recalculé à partir de la semaine en cours. Les semaines
              déjà passées et leurs séances sont conservées.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Select onValueChange={(v) => setSelectedId(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choisir une course…" />
              </SelectTrigger>
              <SelectContent>
                {availableGoals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.race_name} — {g.race_date}
                    {g.sport === 'running' ? ' · course à pied' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={!selectedId || loading}>
              {loading ? 'Recalcul…' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
