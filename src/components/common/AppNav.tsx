'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import {
  LayoutDashboard,
  Activity,
  CalendarRange,
  CalendarDays,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

interface AppNavProps {
  user: User
}

const navLinks: { href: string; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: 'Tableau de bord', shortLabel: 'Accueil', icon: LayoutDashboard },
  { href: '/activities', label: 'Activités', shortLabel: 'Activités', icon: Activity },
  { href: '/program', label: 'Programme', shortLabel: 'Programme', icon: CalendarRange },
  { href: '/calendar', label: 'Calendrier', shortLabel: 'Agenda', icon: CalendarDays },
  { href: '/profile', label: 'Profil', shortLabel: 'Profil', icon: UserRound },
]

export function AppNav({ user }: AppNavProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-sidebar-border bg-sidebar relative">
      {/* Filigrane topographique — crème (currentColor) sur le canard sombre */}
      <div
        className="topo-lines absolute inset-0 pointer-events-none"
        style={{ color: 'oklch(0.97 0.008 200)', opacity: 0.08 }}
      />
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative">
        {/* Logo */}
        <div className="flex items-center gap-10">
          <Link
            href="/dashboard"
            className="flex items-center gap-0.5 font-[family-name:var(--font-display)]"
          >
            <span className="text-xl font-semibold uppercase tracking-[0.15em] text-sidebar-foreground">
              Coach
            </span>
            <span className="text-xl font-semibold uppercase tracking-[0.15em] text-sidebar-primary">
              &nbsp;Tri
            </span>
          </Link>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${
                    active
                      ? 'text-sidebar-primary bg-sidebar-primary/15'
                      : 'text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10'
                  }`}
                >
                  <Icon size={14} strokeWidth={2.5} />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="hidden lg:block text-xs text-sidebar-foreground/55 font-medium truncate max-w-[180px]">
            {user.email}
          </span>
          <button
            onClick={handleSignOut}
            className="text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition-all text-sidebar-foreground/75 hover:text-sidebar-foreground border-sidebar-border hover:border-sidebar-foreground/40"
          >
            Déconnexion
          </button>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-sidebar-border bg-sidebar">
        {navLinks.map(({ href, shortLabel, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[9px] font-bold uppercase tracking-wide transition-colors ${
                active ? 'text-sidebar-primary' : 'text-sidebar-foreground/55'
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {shortLabel}
            </Link>
          )
        })}
      </div>
    </header>
  )
}
