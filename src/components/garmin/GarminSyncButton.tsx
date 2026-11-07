'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
    <Button variant="outline-primary" size="sm" onClick={handleSync} disabled={loading}>
      <RefreshCw aria-hidden className={loading ? 'animate-spin' : undefined} />
      {loading ? 'Sync…' : 'Sync Garmin'}
    </Button>
  )
}
