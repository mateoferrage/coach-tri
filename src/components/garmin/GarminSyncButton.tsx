'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function GarminSyncButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSync() {
    setLoading(true)
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur de synchronisation')
      toast.success(`Sync Garmin réussie — ${data.activities_synced ?? 0} activité(s) importée(s)`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de synchronisation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={loading}
      className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border border-primary/30 text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
    >
      {loading ? '⏳ Sync…' : '↺ Sync Garmin'}
    </button>
  )
}
