'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SessionCard } from './SessionCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { ChevronDown, RefreshCw, Sparkles } from 'lucide-react'
import { SectionLabel } from '@/components/common/SectionLabel'
import { PHASE_LABEL, formatWeekRange } from '@/lib/plan/display'
import { cn } from '@/lib/utils/cn'

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
  planned_tss?: number | null
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

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6] // lundi–samedi

interface WeekViewProps {
  week: Week
  planId: string
  isCurrentWeek: boolean
  defaultOpen?: boolean
}

export function WeekView({ week, planId, isCurrentWeek, defaultOpen = false }: WeekViewProps) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen || isCurrentWeek)
  const [generating, setGenerating] = useState(false)

  const sessions = week.sessions ?? []
  const completedCount = sessions.filter((s) => s.status === 'done').length
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
      router.refresh()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  const phaseLabel = PHASE_LABEL[week.phase] ?? week.phase

  return (
    <section
      aria-labelledby={`week-${week.id}`}
      className={cn(
        'overflow-hidden rounded-xl border bg-card',
        isCurrentWeek ? 'border-primary' : 'border-border',
      )}
    >
      {/* Header */}
      <div className="relative flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {isCurrentWeek && <span className="size-2.5 rounded-full bg-highlight" aria-hidden />}
            <SectionLabel as="h3" id={`week-${week.id}`}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="text-left after:absolute after:inset-0 after:rounded-t-xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring"
              >
                Semaine {week.week_num}
                {isCurrentWeek && <span className="sr-only"> (en cours)</span>}
              </button>
            </SectionLabel>
            {isCurrentWeek && (
              <span className="text-xs font-bold text-highlight-deep" aria-hidden>
                En cours
              </span>
            )}
            {week.is_recovery_week && <Badge variant="outline">Récupération</Badge>}
          </div>
          <p className="mt-1 text-sm font-semibold">
            {formatWeekRange(week.start_date)} · {phaseLabel}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {week.planned_volume_hours} h · {week.planned_tss} TSS
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {hasSessions && (
            <span className="text-xs font-semibold text-muted-foreground tabular-nums">
              {completedCount}/{sessions.length} séances
            </span>
          )}
          <ChevronDown
            size={18}
            className={cn('text-muted-foreground transition-transform', open && 'rotate-180')}
            aria-hidden
          />
        </div>
      </div>

      {/* Content */}
      {open && (
        <div className="border-t border-border px-1 pb-4">
          {week.notes && (
            <p className="px-3 pt-3 text-xs text-muted-foreground italic">{week.notes}</p>
          )}

          {hasSessions ? (
            <ul className="mt-2">
              {sessions
                .sort((a, b) => a.session_date.localeCompare(b.session_date))
                .map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-muted-foreground">Séances non encore générées</p>
              <Button size="sm" onClick={generateSessions} disabled={generating}>
                <Sparkles aria-hidden />
                {generating ? 'Génération en cours…' : "Générer les séances avec l'IA"}
              </Button>
            </div>
          )}

          {hasSessions && (
            <div className="px-3">
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={generateSessions}
                disabled={generating}
              >
                <RefreshCw aria-hidden />
                {generating ? 'Génération…' : 'Regénérer les séances'}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
