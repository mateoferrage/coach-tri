'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function StopProgramButton({ planId }: { planId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleStop() {
    setLoading(true)
    try {
      const res = await fetch(`/api/plans/${planId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erreur serveur')
      setOpen(false)
      router.push('/program')
      router.refresh()
    } catch {
      alert('Une erreur est survenue. Réessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-muted-foreground hover:text-red-400 transition-colors underline underline-offset-4"
      >
        Arrêter le programme
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arrêter le programme ?</DialogTitle>
            <DialogDescription>
              Le programme sera archivé et vous n&apos;aurez plus de programme actif. Vos séances
              réalisées et données Garmin sont conservées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Annuler
            </Button>
            <Button
              onClick={handleStop}
              disabled={loading}
              style={{ backgroundColor: '#ef4444', color: 'white' }}
            >
              {loading ? 'Archivage…' : 'Arrêter le programme'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
