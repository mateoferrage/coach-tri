import { SectionLabel } from '@/components/common/SectionLabel'
import { DisciplineIcon } from '@/components/plan/DisciplineIcon'
import { DISCIPLINE_LABEL } from '@/lib/plan/display'
import type { WeekLoadSummary } from '@/lib/plan/week-summary'

export function WeekLoad({ load }: { load: WeekLoadSummary }) {
  const pct = (v: number) => (load.planned ? (v / load.planned) * 100 : 0)
  const max = Math.max(1, ...load.byDiscipline.map((d) => d.tss))

  return (
    <section
      aria-labelledby="week-load-title"
      className="grid gap-7 rounded-xl border border-border p-5 md:grid-cols-[1fr_1.2fr]"
    >
      <div>
        <SectionLabel id="week-load-title">Charge de la semaine</SectionLabel>
        <p className="mt-3 flex flex-wrap items-baseline gap-2">
          <span className="font-display text-4xl leading-none font-extrabold tabular-nums">
            {load.done}
          </span>
          <span className="text-sm text-muted-foreground">
            / {load.planned} TSS · {load.sessionsDone} séance{load.sessionsDone > 1 ? 's' : ''}{' '}
            faite{load.sessionsDone > 1 ? 's' : ''} sur {load.sessionsTotal}
          </span>
        </p>
        <div
          role="img"
          aria-label={`${load.done} TSS faits et ${load.today} prévus aujourd'hui, sur ${load.planned} TSS prévus`}
          className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted"
        >
          <span className="h-full bg-primary" style={{ width: `${pct(load.done)}%` }} />
          <span className="h-full bg-highlight" style={{ width: `${pct(load.today)}%` }} />
        </div>
        <p className="mt-2 flex gap-4 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-primary" aria-hidden />
            Fait
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-highlight" aria-hidden />
            Aujourd&apos;hui
          </span>
        </p>
      </div>

      {load.byDiscipline.length > 0 && (
        <div>
          <SectionLabel as="h3">Par discipline</SectionLabel>
          <ul className="mt-3 flex flex-col gap-2.5">
            {load.byDiscipline.map((d) => (
              <li
                key={d.discipline}
                className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3 text-sm"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <DisciplineIcon discipline={d.discipline} size={14} />
                  {DISCIPLINE_LABEL[d.discipline] ?? d.discipline}
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(d.tss / max) * 100}%` }}
                  />
                </span>
                <span className="text-right text-muted-foreground tabular-nums">{d.tss} TSS</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
