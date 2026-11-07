import { WeekCalendar } from '@/components/calendar/WeekCalendar'

export const metadata = { title: 'Calendrier — Coach Tri' }

export default function CalendarPage() {
  return (
    // h = 100dvh minus mobile header (3.5rem + safe top) + main py-8 top (2rem) + bottom (9rem + safe bottom); desktop: 2rem + 6rem
    <div className="flex flex-col h-[calc(100dvh_-_14.5rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] md:h-[calc(100dvh-8rem)]">
      <div className="mb-3 flex-shrink-0 flex items-baseline justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Emploi du temps</p>
          <h1 className="text-3xl md:text-4xl">Calendrier</h1>
        </div>
      </div>
      <WeekCalendar />
    </div>
  )
}
