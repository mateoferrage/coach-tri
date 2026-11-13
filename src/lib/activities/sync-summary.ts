import type { ActivitySource } from './unify'

export type SyncResult =
  | { source: ActivitySource; ok: true; count: number; linked?: number }
  | { source: ActivitySource; ok: false; error: string }

const LABEL: Record<ActivitySource, string> = { garmin: 'Garmin', strava: 'Strava' }

/** Message affiché après « Synchroniser » : un résultat par source, niveau selon les échecs. */
export function syncSummary(results: SyncResult[]): {
  level: 'success' | 'warning' | 'error'
  message: string
} {
  const message = results
    .map((r) => {
      const detail = r.ok ? `${r.count} ${r.count > 1 ? 'activités' : 'activité'}` : r.error
      return `${LABEL[r.source]} : ${detail}`
    })
    .join(' · ')
  const linked = results.reduce((n, r) => n + (r.ok ? (r.linked ?? 0) : 0), 0)
  const linkedText = linked
    ? ` · ${linked} ${linked > 1 ? 'séances validées' : 'séance validée'} automatiquement`
    : ''
  const failed = results.filter((r) => !r.ok).length
  const level = failed === 0 ? 'success' : failed === results.length ? 'error' : 'warning'
  return { level, message: message + linkedText }
}
