'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import {
  Activity,
  CalendarDays,
  CalendarRange,
  LogOut,
  Timer,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCountdown, type RaceSummary } from '@/lib/plan/nav-summary'
import { cn } from '@/lib/utils/cn'
import { Logo } from '@/components/common/Logo'

interface AppNavProps {
  user: User
  race: RaceSummary | null
}

const navLinks: { href: string; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: "Aujourd'hui", shortLabel: 'Accueil', icon: Timer },
  { href: '/program', label: 'Programme', shortLabel: 'Programme', icon: CalendarRange },
  { href: '/calendar', label: 'Calendrier', shortLabel: 'Agenda', icon: CalendarDays },
  { href: '/activities', label: 'Activités', shortLabel: 'Activités', icon: Activity },
  { href: '/profile', label: 'Profil', shortLabel: 'Profil', icon: UserRound },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

function Countdown({ daysLeft, className }: { daysLeft: number; className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full bg-highlight font-display leading-none font-extrabold text-highlight-foreground',
        className,
      )}
    >
      {formatCountdown(daysLeft)}
    </span>
  )
}

export function AppNav({ user, race }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <>
      {/* Bureau : colonne bleue */}
      <aside className="sticky top-0 hidden h-screen w-[210px] shrink-0 flex-col gap-7 bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
        <Logo href="/dashboard" className="px-2 text-[19px]" />

        <nav aria-label="Navigation principale" className="flex flex-col gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-base transition-colors',
                  active
                    ? 'bg-sidebar-primary font-bold text-sidebar-primary-foreground'
                    : 'font-semibold text-sidebar-foreground hover:bg-sidebar-accent',
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? 'text-highlight' : undefined}
                />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          {race && (
            <div className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-sidebar-border p-3.5 text-[13px] font-semibold">
              <span>Objectif principal</span>
              <b className="text-base leading-tight font-bold">{race.raceName}</b>
              <Countdown daysLeft={race.daysLeft} className="self-start px-3 py-1 text-lg" />
              <span>
                Semaine {race.weekNum} sur {race.totalWeeks}
              </span>
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-sidebar-border pt-3 text-[13px]">
            <span className="truncate font-semibold">{user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-2 self-start rounded-md py-1 font-bold hover:underline focus-visible:outline-2 focus-visible:outline-sidebar-ring"
            >
              <LogOut size={14} />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile : en-tête fin */}
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 bg-sidebar px-4 pt-[env(safe-area-inset-top)] text-sidebar-foreground md:hidden">
        <Logo href="/dashboard" className="text-[19px]" />
        <div className="flex items-center gap-3">
          {race && <Countdown daysLeft={race.daysLeft} className="px-2.5 py-1 text-base" />}
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Déconnexion"
            className="flex size-9 items-center justify-center rounded-full hover:bg-sidebar-accent"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Mobile : barre d'onglets */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 flex bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {navLinks.map(({ href, shortLabel, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2.5 text-[13px] tracking-tight text-sidebar-foreground transition-colors',
                active ? 'font-bold' : 'font-semibold',
              )}
            >
              {active && (
                <span className="absolute inset-x-4 top-0 h-[3px] rounded-b bg-highlight" />
              )}
              <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
              <span className="max-w-full truncate">{shortLabel}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
