import { WeekCalendar } from "@/components/calendar/WeekCalendar";

export const metadata = { title: "Calendrier — Coach Tri" };

export default function CalendarPage() {
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 9rem)" }}>
      <div className="mb-6 flex-shrink-0">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Emploi du temps
        </p>
        <h1 className="text-3xl font-black uppercase tracking-tight">
          Calendrier
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tes cours et stages sont automatiquement pris en compte par le coach IA.
        </p>
      </div>
      <WeekCalendar />
    </div>
  );
}
