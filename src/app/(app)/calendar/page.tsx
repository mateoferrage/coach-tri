import { WeekCalendar } from '@/components/calendar/WeekCalendar'

export const metadata = { title: 'Calendrier — Coach Tri' }

export default function CalendarPage() {
  return (
    // h = 100dvh minus AppNav (4rem) + main padding (4rem desktop / 8rem mobile)
    <div className="flex flex-col h-[calc(100dvh-12rem)] md:h-[calc(100dvh-8rem)]">
      <div className="mb-3 flex-shrink-0 flex items-baseline justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Emploi du temps
          </p>
          <h1 className="text-2xl font-semibold uppercase tracking-tight">Calendrier</h1>
        </div>
      </div>
      <WeekCalendar />
    </div>
  )
}
