'use client'

import { useState } from 'react'
import { SessionCard } from './SessionCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Session {
  id: string
  title: string
  session_date: string
  discipline: string
  session_type: string
  duration_min: number
  expected_rpe: number | null
  status: string
  coaching_note: string | null
}

interface Week {
  id: string
  week_num: number
  phase: string
  is_recovery_week: boolean
  planned_volume_hours: number
  planned_tss: number
  start_date: string
  notes: string | null
  sessions: Session[]
}

const PHASE_LABELS: Record<string, string> = {
  prep: 'Prépa', base: 'Base', build: 'Construction',
  peak: 'Pic', taper: 'Affûtage', race: 'Course', maintenance: 'Maintien',
}

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6] // lundi–samedi

interface WeekViewProps {
  week: Week
  planId: string
  isCurrentWeek: boolean
  defaultOpen?: boolean
}

export function WeekView({ week, planId, isCurrentWeek, defaultOpen = false }: WeekViewProps) {
  const [open, setOpen] = useState(defaultOpen || isCurrentWeek)
  const [generating, setGenerating] = useState(false)

  const sessions = week.sessions ?? []
  const completedCount = sessions.filter(s => s.status === 'done').length
  const hasSessions = sessions.length > 0

  async function generateSessions() {
    setGenerating(true)
    try {
      const res = await fetch(`/api/plans/${planId}/regenerate-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_num: week.week_num,
          available_days: DEFAULT_DAYS,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      toast.success(`${data.sessions_created} séances générées`)
      // Reload to get fresh data
      window.location.reload()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  const weekStart = parseISO(week.start_date)

  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all ${
      isCurrentWeek ? 'border-zinc-900' : 'border-zinc-200'
    }`}>
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Semaine {week.week_num}</span>
              {isCurrentWeek && <Badge variant="default" className="text-xs">En cours</Badge>}
              {week.is_recovery_week && <Badge variant="secondary" className="text-xs">Récupération</Badge>}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {format(weekStart, 'd MMM', { locale: fr })} ·{' '}
              {PHASE_LABELS[week.phase] ?? week.phase} ·{' '}
              {week.planned_volume_hours}h · TSS {week.planned_tss}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasSessions && (
            <span className="text-xs text-zinc-500">
              {completedCount}/{sessions.length} séances
            </span>
          )}
          <span className="text-zinc-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Content */}
      {open && (
        <div className="px-4 pb-4 border-t border-zinc-100">
          {week.notes && (
            <p className="text-xs text-zinc-500 italic py-3">{week.notes}</p>
          )}

          {hasSessions ? (
            <div className="grid gap-2 mt-3">
              {sessions
                .sort((a, b) => a.session_date.localeCompare(b.session_date))
                .map(session => (
                  <SessionCard key={session.id} session={session} />
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-zinc-500">Séances non encore générées</p>
              <Button
                size="sm"
                onClick={generateSessions}
                disabled={generating}
              >
                {generating ? 'Génération en cours…' : 'Générer les séances avec l\'IA'}
              </Button>
            </div>
          )}

          {hasSessions && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={generateSessions}
              disabled={generating}
            >
              {generating ? 'Génération…' : 'Regénérer les séances'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
