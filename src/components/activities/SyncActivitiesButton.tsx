'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ActivitySource } from '@/lib/activities/unify'
import { syncSummary, type SyncResult } from '@/lib/activities/sync-summary'

async function syncOne(source: ActivitySource): Promise<SyncResult> {
  try {
    const res = await fetch(`/api/${source}/sync`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { source, ok: false, error: data.error ?? 'échec de la synchronisation' }
    return {
      source,
      ok: true,
      count: data.activities_synced ?? 0,
      linked: data.sessions_linked ?? 0,
    }
  } catch {
    return { source, ok: false, error: 'erreur réseau' }
  }
}

/** Lance la synchronisation de chaque compte connecté, en parallèle. */
export function SyncActivitiesButton({ garmin, strava }: { garmin: boolean; strava: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const sources: ActivitySource[] = [
    ...(garmin ? (['garmin'] as const) : []),
    ...(strava ? (['strava'] as const) : []),
  ]
  if (sources.length === 0) return null

  async function handleSync() {
    setLoading(true)
    const { level, message } = syncSummary(await Promise.all(sources.map(syncOne)))
    toast[level](message)
    setLoading(false)
    router.refresh()
  }

  return (
    <Button variant="outline-primary" size="sm" onClick={handleSync} disabled={loading}>
      <RefreshCw aria-hidden className={loading ? 'animate-spin' : undefined} />
      {loading ? 'Synchronisation…' : 'Synchroniser'}
    </Button>
  )
}
