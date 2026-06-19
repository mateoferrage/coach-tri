# Calendar Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the weekly calendar professional and error-free — extract its fragile logic into tested pure modules, bring it back into the OKLCH "Lagune" theme, fix overlap rendering, harden network errors, and improve keyboard accessibility, without adding features.

**Architecture:** Pull pure logic out of `WeekCalendar.tsx` and `/api/schedule/route.ts` into `src/lib/calendar/{time,layout,recurrence}.ts`, each with colocated Vitest tests. Then refactor the component to consume those helpers + `theme.ts` tokens, and clean up data-layer debt.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest, date-fns v4, Supabase, Tailwind v4 + inline OKLCH tokens, sonner (toasts).

---

## Conventions (read before starting)

- Prettier: **single quotes, no semicolons**. Run `npm run format` before committing.
- Tests: Vitest, `node` environment, files colocated as `*.test.ts`, `@` alias → `src/`. Header: `import { describe, it, expect } from 'vitest'`.
- `AGENTS.md` rule: **never commit/push without explicit user request.** Commit steps below are the intended units; during execution, hold them and ask the user before running git (or batch at the end on a feature branch off `main`).
- Verification chain (must stay green): `npm run typecheck && npm run lint && npm test && npm run format:check`.

## File Structure

- Create `src/lib/calendar/time.ts` — `timeToFrac`, `parseLocalDate`. Pure date/time helpers.
- Create `src/lib/calendar/time.test.ts`.
- Create `src/lib/calendar/layout.ts` — grid constants (`HOUR_PX`, `START_HOUR`, `END_HOUR`), `topPx`, `heightPx`, `assignColumns`. Pure geometry.
- Create `src/lib/calendar/layout.test.ts`.
- Create `src/lib/calendar/recurrence.ts` — `expandEvents` (moved from the API route).
- Create `src/lib/calendar/recurrence.test.ts`.
- Modify `src/lib/theme.ts` — add `EVENT_TYPE` record + `eventTypeColor()`/`eventTypeLabel()` helpers.
- Modify `src/app/api/schedule/route.ts` — import `expandEvents`, drop inline copy + read cast.
- Modify `src/app/api/sessions/route.ts` — drop the `session_time` fallback branch.
- Modify `src/components/calendar/WeekCalendar.tsx` — tokens, lib helpers, `assignColumns`, error/empty states, a11y.
- Modify `src/components/calendar/EventModal.tsx` — consume `EVENT_TYPE` tokens.

---

## Task 1: `time.ts` — safe date/time helpers

**Files:**

- Create: `src/lib/calendar/time.ts`
- Test: `src/lib/calendar/time.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { timeToFrac, parseLocalDate } from './time'

describe('timeToFrac', () => {
  it('converts midnight to 0', () => {
    expect(timeToFrac('00:00')).toBe(0)
  })
  it('converts 06:30 to 6.5', () => {
    expect(timeToFrac('06:30')).toBe(6.5)
  })
  it('ignores seconds suffix', () => {
    expect(timeToFrac('22:00:00')).toBe(22)
  })
})

describe('parseLocalDate', () => {
  it('parses yyyy-MM-dd at local midnight (no UTC day shift)', () => {
    const d = parseLocalDate('2026-06-19')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5) // June = 5
    expect(d.getDate()).toBe(19)
    expect(d.getHours()).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calendar/time.test.ts`
Expected: FAIL — cannot find module `./time`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { parse } from 'date-fns'

/** "HH:MM" or "HH:MM:SS" → hours as a float (e.g. "06:30" → 6.5). */
export function timeToFrac(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h + m / 60
}

/** Parse a "yyyy-MM-dd" string as a LOCAL date at midnight (avoids UTC day-shift). */
export function parseLocalDate(s: string): Date {
  return parse(s, 'yyyy-MM-dd', new Date())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calendar/time.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit** (hold per AGENTS.md — ask user first)

```bash
git add src/lib/calendar/time.ts src/lib/calendar/time.test.ts
git commit -m "feat(calendar): pure time helpers with tests"
```

---

## Task 2: `layout.ts` — grid geometry + overlap columns

**Files:**

- Create: `src/lib/calendar/layout.ts`
- Test: `src/lib/calendar/layout.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { topPx, heightPx, assignColumns, HOUR_PX, START_HOUR } from './layout'

const get = (x: { s: number; e: number }) => [x.s, x.e] as const

describe('topPx / heightPx', () => {
  it('places START_HOUR at the top', () => {
    expect(topPx(START_HOUR)).toBe(0)
  })
  it('one hour below start is HOUR_PX', () => {
    expect(topPx(START_HOUR + 1)).toBe(HOUR_PX)
  })
  it('enforces a minimum height', () => {
    expect(heightPx(8, 8)).toBeGreaterThanOrEqual(20)
  })
})

describe('assignColumns', () => {
  it('gives a single column when nothing overlaps', () => {
    const items = [
      { s: 6, e: 7 },
      { s: 8, e: 9 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.every((o) => o.cols === 1 && o.col === 0)).toBe(true)
  })
  it('splits two overlapping items into two columns', () => {
    const items = [
      { s: 6, e: 8 },
      { s: 7, e: 9 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.map((o) => o.cols)).toEqual([2, 2])
    expect(new Set(out.map((o) => o.col))).toEqual(new Set([0, 1]))
  })
  it('splits three simultaneous items into three columns', () => {
    const items = [
      { s: 6, e: 9 },
      { s: 6, e: 9 },
      { s: 6, e: 9 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.every((o) => o.cols === 3)).toBe(true)
    expect(new Set(out.map((o) => o.col))).toEqual(new Set([0, 1, 2]))
  })
  it('treats adjacent (touching) items as non-overlapping', () => {
    const items = [
      { s: 6, e: 7 },
      { s: 7, e: 8 },
    ]
    const out = assignColumns(
      items,
      (x) => get(x)[0],
      (x) => get(x)[1],
    )
    expect(out.every((o) => o.cols === 1)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calendar/layout.test.ts`
Expected: FAIL — cannot find module `./layout`.

- [ ] **Step 3: Write minimal implementation**

```ts
export const HOUR_PX = 44
export const START_HOUR = 6
export const END_HOUR = 22

export function topPx(h: number): number {
  return (h - START_HOUR) * HOUR_PX
}

export function heightPx(start: number, end: number): number {
  return Math.max((end - start) * HOUR_PX - 3, 20)
}

export interface Placed<T> {
  item: T
  col: number
  cols: number
}

/**
 * Lay out time intervals into side-by-side columns so overlapping items never
 * stack on top of each other. Items that share a connected overlap cluster get
 * the same `cols` (total columns in that cluster); each gets its own `col`.
 * Touching intervals (end === next start) are treated as NON-overlapping.
 */
export function assignColumns<T>(
  items: T[],
  getStart: (item: T) => number,
  getEnd: (item: T) => number,
): Placed<T>[] {
  const sorted = items
    .map((item, i) => ({ item, start: getStart(item), end: getEnd(item), i }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const result = new Map<number, { col: number; cols: number }>()
  let cluster: typeof sorted = []
  let clusterEnd = -Infinity

  const flush = () => {
    if (cluster.length === 0) return
    // Greedy column assignment within the cluster.
    const colEnds: number[] = []
    for (const ev of cluster) {
      let placed = -1
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= ev.start) {
          placed = c
          break
        }
      }
      if (placed === -1) {
        placed = colEnds.length
        colEnds.push(ev.end)
      } else {
        colEnds[placed] = ev.end
      }
      result.set(ev.i, { col: placed, cols: 0 })
    }
    const total = colEnds.length
    for (const ev of cluster) result.get(ev.i)!.cols = total
    cluster = []
    clusterEnd = -Infinity
  }

  for (const ev of sorted) {
    if (cluster.length > 0 && ev.start >= clusterEnd) flush()
    cluster.push(ev)
    clusterEnd = Math.max(clusterEnd, ev.end)
  }
  flush()

  return sorted.map(({ item, i }) => ({ item, ...result.get(i)! }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calendar/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (hold per AGENTS.md — ask user first)

```bash
git add src/lib/calendar/layout.ts src/lib/calendar/layout.test.ts
git commit -m "feat(calendar): grid geometry + overlap column layout with tests"
```

---

## Task 3: `recurrence.ts` — move `expandEvents` out of the route

**Files:**

- Create: `src/lib/calendar/recurrence.ts`
- Test: `src/lib/calendar/recurrence.test.ts`
- Modify: `src/app/api/schedule/route.ts:8-60` (remove inline `expandEvents`, import it)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { expandEvents } from './recurrence'
import type { ScheduleEventRow } from '@/lib/schemas/schedule'

const base: Omit<ScheduleEventRow, 'id' | 'event_date' | 'is_recurring'> = {
  user_id: 'u1',
  title: 'Test',
  event_type: 'cours',
  start_time: '08:00',
  end_time: '10:00',
  created_at: '',
  updated_at: '',
}

// Week of Mon 2026-06-15 .. Sun 2026-06-21
const weekStart = new Date(2026, 5, 15)

describe('expandEvents', () => {
  it('emits a one-off event that falls in the week', () => {
    const rows = [{ ...base, id: '1', is_recurring: false, event_date: '2026-06-17' }]
    const out = expandEvents(rows as ScheduleEventRow[], weekStart)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-17')
    expect(out[0].source_id).toBe('1')
  })

  it('expands a weekly recurring event to its matching day', () => {
    // recurrence_day 3 = Wednesday → 2026-06-17
    const rows = [
      {
        ...base,
        id: '2',
        is_recurring: true,
        event_date: '2026-06-03',
        recurrence_day: 3,
        recurrence_end_date: '2026-12-31',
      },
    ]
    const out = expandEvents(rows as ScheduleEventRow[], weekStart)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-17')
    expect(out[0].is_recurring).toBe(true)
  })

  it('does not emit recurring occurrences after recurrence_end_date', () => {
    const rows = [
      {
        ...base,
        id: '3',
        is_recurring: true,
        event_date: '2026-06-03',
        recurrence_day: 3,
        recurrence_end_date: '2026-06-10',
      },
    ]
    expect(expandEvents(rows as ScheduleEventRow[], weekStart)).toHaveLength(0)
  })

  it('does not emit occurrences before the series start (event_date)', () => {
    const rows = [
      {
        ...base,
        id: '4',
        is_recurring: true,
        event_date: '2026-06-18', // Thursday, after the Wed occurrence
        recurrence_day: 3,
      },
    ]
    expect(expandEvents(rows as ScheduleEventRow[], weekStart)).toHaveLength(0)
  })

  it('derives recurrence_day from event_date when absent', () => {
    const rows = [
      { ...base, id: '5', is_recurring: true, event_date: '2026-06-03' }, // a Wednesday
    ]
    const out = expandEvents(rows as ScheduleEventRow[], weekStart)
    expect(out).toHaveLength(1)
    expect(out[0].date).toBe('2026-06-17')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/calendar/recurrence.test.ts`
Expected: FAIL — cannot find module `./recurrence`.

- [ ] **Step 3: Write the implementation** (move the existing logic verbatim from the route, switch to a named export)

```ts
import { addDays, getISODay, format, parseISO } from 'date-fns'
import type { ScheduleEventRow, CalendarEvent } from '@/lib/schemas/schedule'

/** Expand recurring events into concrete occurrences for a 7-day window. */
export function expandEvents(rows: ScheduleEventRow[], weekStart: Date): CalendarEvent[] {
  const events: CalendarEvent[] = []

  for (const row of rows) {
    if (!row.is_recurring) {
      events.push({
        id: `${row.id}__${row.event_date}`,
        title: row.title,
        event_type: row.event_type as CalendarEvent['event_type'],
        date: row.event_date,
        start_time: row.start_time,
        end_time: row.end_time,
        is_recurring: false,
        source_id: row.id,
        event_date: row.event_date,
      })
      continue
    }

    const recurrenceDay = row.recurrence_day ?? getISODay(parseISO(row.event_date))
    const recurrenceEnd = row.recurrence_end_date ? parseISO(row.recurrence_end_date) : null
    const eventStart = parseISO(row.event_date)

    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i)
      if (getISODay(day) !== recurrenceDay) continue
      if (day < eventStart) continue
      if (recurrenceEnd && day > recurrenceEnd) continue

      const dateStr = format(day, 'yyyy-MM-dd')
      events.push({
        id: `${row.id}__${dateStr}`,
        title: row.title,
        event_type: row.event_type as CalendarEvent['event_type'],
        date: dateStr,
        start_time: row.start_time,
        end_time: row.end_time,
        is_recurring: true,
        source_id: row.id,
        event_date: row.event_date,
        recurrence_day: row.recurrence_day ?? undefined,
        recurrence_end_date: row.recurrence_end_date ?? undefined,
      })
    }
  }

  return events
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/calendar/recurrence.test.ts`
Expected: PASS.

- [ ] **Step 5: Update the route to import the helper**

In `src/app/api/schedule/route.ts`:

- Delete the inline `expandEvents` function (lines ~10-60) and the now-unused `date-fns` imports it relied on solely (`getISODay`; keep `addDays`/`format`/`parseISO` only if still used below — they are: `parseISO`/`addDays`/`format` are used in `GET`).
- Add at the top: `import { expandEvents } from '@/lib/calendar/recurrence'`.
- Also remove the read cast on the query: change

```ts
  const { data, error } = (await supabase
    .from('schedule_events')
    .select('*')
    ...
    .order('event_date', { ascending: true })) as {
    data: ScheduleEventRow[] | null
    error: { message: string } | null
  }
```

to (factories are typed `<Database>`):

```ts
  const { data, error } = await supabase
    .from('schedule_events')
    .select('*')
    ...
    .order('event_date', { ascending: true })
```

and pass `expandEvents((data ?? []) as ScheduleEventRow[], weekStart)` — keep a single scoped cast only if the generated row type differs from `ScheduleEventRow`; otherwise drop it. Verify with typecheck.

- [ ] **Step 6: Verify route still compiles and tests pass**

Run: `npm run typecheck && npx vitest run src/lib/calendar`
Expected: typecheck clean, all calendar tests PASS.

- [ ] **Step 7: Commit** (hold per AGENTS.md — ask user first)

```bash
git add src/lib/calendar/recurrence.ts src/lib/calendar/recurrence.test.ts src/app/api/schedule/route.ts
git commit -m "refactor(calendar): extract expandEvents into tested lib module"
```

---

## Task 4: `theme.ts` — `EVENT_TYPE` tokens

**Files:**

- Modify: `src/lib/theme.ts` (append after the `DISCIPLINE` block / `disciplineColor`)

- [ ] **Step 1: Add the record + helpers**

```ts
/** Système couleur + label par type d'événement personnel (agenda). */
export const EVENT_TYPE: Record<string, { label: string; color: string }> = {
  cours: { label: 'Cours', color: 'oklch(0.52 0.18 300)' }, // violet
  stage: { label: 'Stage', color: 'oklch(0.624 0.121 64.7)' }, // ambre
  rdv: { label: 'RDV', color: 'oklch(0.546 0.094 183.4)' }, // teal-vert
  autre: { label: 'Autre', color: 'oklch(0.540 0.024 203.9)' }, // acier
}

export function eventTypeColor(t: string | null | undefined): string {
  return EVENT_TYPE[t ?? '']?.color ?? EVENT_TYPE.autre.color
}

export function eventTypeLabel(t: string | null | undefined): string {
  return EVENT_TYPE[t ?? '']?.label ?? EVENT_TYPE.autre.label
}
```

- [ ] **Step 2: Verify contrast of the new accent colors**

Run: `node scripts/a11y-contrast.mjs`
Expected: no new failures introduced by the event-type colors used as text/borders. (These are used as borders/pills with dark text `ACCENT_FG` is white pills → if a pill uses `color: '#0a1a0d'` replace with a dark token; check ratio.) If a color fails as text, darken its L until it passes ≥ 4.5:1.

- [ ] **Step 3: Verify chain**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit** (hold per AGENTS.md — ask user first)

```bash
git add src/lib/theme.ts
git commit -m "feat(theme): event-type color tokens for calendar"
```

---

## Task 5: `WeekCalendar.tsx` — tokens, lib helpers, overlap, a11y, errors

**Files:**

- Modify: `src/components/calendar/WeekCalendar.tsx` (whole file)

> This is the largest task. Do it in sub-steps and run `npm run typecheck` after each sub-step.

- [ ] **Step 1: Replace local logic/constants with lib imports**

Remove the local `HOUR_PX`, `START_HOUR`, `END_HOUR`, `timeToFrac`, `topPx`, `heightPx` definitions. Import instead:

```ts
import {
  HOUR_PX,
  START_HOUR,
  END_HOUR,
  topPx,
  heightPx,
  assignColumns,
} from '@/lib/calendar/layout'
import { timeToFrac } from '@/lib/calendar/time'
```

- [ ] **Step 2: Replace local color/label maps with theme**

Remove `DISC_COLORS`, `DISC_FALLBACK`, `EV_COLORS`, `DISC_LABEL`, `EV_LABEL`. Import:

```ts
import {
  DISCIPLINE,
  disciplineColor,
  EVENT_TYPE,
  eventTypeColor,
  eventTypeLabel,
  withAlpha,
  SLATE,
  SURFACE,
  SURFACE_DEEP,
  DIVIDER,
  TEXT,
  TEXT_MUTED,
  TEXT_FAINT,
  ACCENT,
  ACCENT_FG,
} from '@/lib/theme'
```

Discipline label lookups become `DISCIPLINE[sess.discipline]?.label ?? 'Séance'`; colors become `disciplineColor(sess.discipline)` with `withAlpha(color, 14)` for the tinted background and the solid color for the left border / pill. Event colors become `eventTypeColor(ev.event_type)` / `eventTypeLabel(ev.event_type)`.

- [ ] **Step 3: Swap every hardcoded color for a token**

Replace all literals:

- `#15261c` and `#1a2e22` (grid backgrounds) → `SURFACE` (cards/grid) and alternating rows `withAlpha(SURFACE_DEEP, 60)` / `SURFACE`.
- `rgba(255,255,255,0.08)` / `0.04` (borders) → `DIVIDER` (and a lighter `withAlpha(TEXT, 6)` for the faint hour lines).
- `rgba(94,245,160,…)` (drop target highlight) → `withAlpha(ACCENT, 10)` bg + `withAlpha(ACCENT, 40)` outline.
- `oklch(0.287 0.047 217.9)` literals → `TEXT`; `oklch(0.504 0.038 203.1)` → `TEXT_MUTED`.
- `rgba(255,255,255,0.45)` (hour labels) → `TEXT_FAINT`.
- `color: '#0a1a0d'` on pills (dark text on colored pill) → `ACCENT_FG` only if the pill bg is dark; for light theme prefer `color: SURFACE` (white) on a saturated pill, or `TEXT` on a light pill — pick whichever passes contrast (verify in Step 8).
- "today" circle text on accent bg → `ACCENT_FG`.

Run `npm run typecheck` after this step.

- [ ] **Step 4: Apply `assignColumns` to events + sessions per day column**

Inside the per-day render, build a combined or per-kind placement. Sessions and events render in the same column space, so place them together:

```ts
type Block =
  | { kind: 'event'; ev: CalendarEvent; start: number; end: number }
  | { kind: 'session'; sess: TrainingSession; start: number; end: number }

const blocks: Block[] = [
  ...dayCalEvs.map((ev) => ({
    kind: 'event' as const,
    ev,
    start: timeToFrac(ev.start_time),
    end: timeToFrac(ev.end_time),
  })),
  ...daySessions.map((sess) => {
    const start = sess.session_time
      ? timeToFrac(sess.session_time)
      : (DAY_PART_HOUR[sess.day_part ?? ''] ?? 7)
    return { kind: 'session' as const, sess, start, end: start + (sess.duration_min ?? 60) / 60 }
  }),
]

const placed = assignColumns(
  blocks,
  (b) => b.start,
  (b) => b.end,
)
```

Then render each `placed` entry computing horizontal geometry from `col`/`cols`:

```ts
const widthPct = 100 / p.cols
const leftPct = p.col * widthPct
// style: left: `calc(${leftPct}% + 3px)`, width: `calc(${widthPct}% - 6px)`
// (drop the old fixed left:3 right:3)
```

Keep the existing `top`/`height` via `topPx(start)` / `heightPx(start, end)`, the discipline/event coloring, the drag handlers on sessions, and the click-to-edit on events.

Run `npm run typecheck` after this step.

- [ ] **Step 5: Make event/session blocks keyboard-accessible**

Each event block and session block gets:

- `role="button"`, `tabIndex={0}`
- `aria-label` e.g. `` `${ev.title}, ${ev.start_time}–${ev.end_time}` `` (events) / `` `${title}, ${duration} minutes` `` (sessions)
- `onKeyDown` handling Enter and Space → same action as click (open edit modal / navigate). For the session link, keep the `<a href>` but add the keyboard handler on the wrapper that triggers navigation, or keep the anchor as the focusable element (anchors are already keyboard-activable — prefer making the title anchor the primary control and give the wrapper `aria-label`).
- Visible focus: `outline` using `withAlpha(ACCENT, 60)` on `:focus-visible` (inline `onFocus`/`onBlur` or a small CSS class).

- [ ] **Step 6: Handle fetch errors + empty state**

Add `const [error, setError] = useState<string | null>(null)`. In `load()`:

```ts
try {
  setError(null)
  const [evRes, sessRes] = await Promise.all([...])
  if (!evRes.ok || !sessRes.ok) throw new Error('fetch failed')
  setCalEvents(await evRes.json())
  setSessions(await sessRes.json())
} catch {
  setError('Impossible de charger le calendrier.')
  toast.error('Impossible de charger le calendrier.')
} finally {
  setLoading(false)
}
```

Render, above/over the grid: if `error`, show a centered message with a "Réessayer" button that re-runs the loader (extract `load` so it can be called from the button). If not loading, not error, and `calEvents.length === 0 && sessions.length === 0`, show a subtle empty hint (e.g. an overlay line "Aucun créneau cette semaine") — keep the grid visible underneath.

Also handle the existing `refreshEvents` similarly (toast on failure).

Run `npm run typecheck` after this step.

- [ ] **Step 7: Run unit tests + lint + format**

Run: `npm test && npm run lint && npm run format`
Expected: tests PASS, lint clean, format applied.

- [ ] **Step 8: Contrast check**

Run: `node scripts/a11y-contrast.mjs`
Expected: no failures for the calendar's text colors. Fix any flagged color by adjusting to the nearest passing token.

- [ ] **Step 9: Commit** (hold per AGENTS.md — ask user first)

```bash
git add src/components/calendar/WeekCalendar.tsx
git commit -m "refactor(calendar): theme tokens, overlap columns, a11y, error/empty states"
```

---

## Task 6: `EventModal.tsx` — consume `EVENT_TYPE` tokens

**Files:**

- Modify: `src/components/calendar/EventModal.tsx`

- [ ] **Step 1: Replace the local `EVENT_TYPES` colors with theme**

Keep the emoji labels but source the accent color from `EVENT_TYPE` so the selected-type highlight matches the calendar. Replace the hardcoded `oklch(0.63 0.18 300 …)` selection styles with `eventTypeColor(value)` + `withAlpha(...)`. Import from `@/lib/theme`:

```ts
import {
  EVENT_TYPE,
  eventTypeColor,
  withAlpha,
  /* existing: */ ACCENT,
  ACCENT_FG,
  SURFACE,
  DIVIDER,
  TEXT,
  TEXT_FAINT,
} from '@/lib/theme'
```

For each type button, when selected: `borderColor: eventTypeColor(value)`, `backgroundColor: withAlpha(eventTypeColor(value), 12)`, `color: eventTypeColor(value)`; when not: `border: DIVIDER`, `color: TEXT_FAINT`, `backgroundColor: SURFACE`.

Replace any remaining raw `oklch(0.287 0.047 217.9)` literals with `TEXT`.

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint && node scripts/a11y-contrast.mjs`
Expected: clean, no new contrast failures.

- [ ] **Step 3: Commit** (hold per AGENTS.md — ask user first)

```bash
git add src/components/calendar/EventModal.tsx
git commit -m "refactor(calendar): EventModal uses shared event-type tokens"
```

---

## Task 7: Clean up data-layer debt (`/api/sessions`)

**Files:**

- Modify: `src/app/api/sessions/route.ts:17-39`

- [ ] **Step 1: Remove the `session_time` fallback branch**

Replace the `let { data, error }` + retry block with a single typed query (column confirmed by migration `0015_session_time.sql`):

```ts
const { data, error } = await supabase
  .from('sessions')
  .select(
    'id, title, discipline, session_type, session_date, duration_min, status, day_part, session_time',
  )
  .eq('user_id', user.id)
  .gte('session_date', start)
  .lte('session_date', end)
  .order('session_date', { ascending: true })

if (error) return apiError(error.message)
return apiSuccess(data)
```

Remove the now-unused `unknown[]` typing and the `(error as { message: string })` cast (the typed factory gives a typed `error`).

- [ ] **Step 2: Verify**

Run: `npm run typecheck && npm run lint`
Expected: clean.

- [ ] **Step 3: Commit** (hold per AGENTS.md — ask user first)

```bash
git add src/app/api/sessions/route.ts
git commit -m "refactor(api): drop session_time fallback (column is migrated)"
```

---

## Task 8: Full verification + visual check

- [ ] **Step 1: Run the full chain**

Run: `npm run typecheck && npm run lint && npm test && npm run format:check`
Expected: all green. Fix anything that isn't before proceeding.

- [ ] **Step 2: Launch the app and verify visually**

Run: `npm run dev` (then open `/calendar` while logged in).
Check:

- Theme: light "Lagune" surfaces, no dark green/`#15261c` backgrounds, readable text.
- Click an empty slot → create modal; create an event → appears in the right day/time.
- Click an event → edit modal; edit + delete work.
- Drag a session to another slot (desktop) → moves, persists on reload.
- Two overlapping items render side-by-side (not stacked).
- Disconnect network / force a 500 → error message + "Réessayer".
- A week with no items → empty hint.
- Tab through events → focus ring visible; Enter opens edit.

- [ ] **Step 3: Final commit** (hold per AGENTS.md — ask user first)

If any formatting/fixups happened during verification:

```bash
git add -A
git commit -m "chore(calendar): verification fixups"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** §1 → Tasks 1-3; §2 → Tasks 4-6; §3 → Task 5 (steps 5-6) + contrast checks; §4 → Tasks 3 (cast) + 7; §5 DoD → Task 8. ✅ All spec sections mapped.
- **Placeholder scan:** No TBD/TODO; all code steps contain full code. ✅
- **Type consistency:** `assignColumns(items, getStart, getEnd) → Placed<T>[]` used consistently (Task 2 def ↔ Task 5 use). `expandEvents(rows, weekStart)` signature identical in route + tests. `eventTypeColor`/`eventTypeLabel`/`disciplineColor` names consistent across theme + components. ✅
