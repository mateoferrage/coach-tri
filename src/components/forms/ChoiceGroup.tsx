'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export interface Choice<T extends string> {
  value: T
  label: string
  hint?: string
  icon?: ReactNode
}

/**
 * Groupe de choix exclusifs affichés en tuiles (remplace les menus déroulants
 * quand il n'y a que quelques options : tout est visible d'un coup d'œil).
 * Sémantique radiogroup, navigation aux flèches.
 */
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  columns = 2,
  size = 'md',
}: {
  label: string
  choices: readonly Choice<T>[]
  value: T | undefined
  onChange: (value: T) => void
  columns?: 2 | 3
  size?: 'sm' | 'md'
}) {
  const activeIndex = choices.findIndex((c) => c.value === value)

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-2', columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}
    >
      {choices.map((c, index) => {
        const active = c.value === value
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active || (activeIndex === -1 && index === 0) ? 0 : -1}
            onClick={() => onChange(c.value)}
            onKeyDown={(e) => {
              const step =
                e.key === 'ArrowRight' || e.key === 'ArrowDown'
                  ? 1
                  : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                    ? -1
                    : 0
              if (!step) return
              e.preventDefault()
              const next = (index + step + choices.length) % choices.length
              onChange(choices[next].value)
              e.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                [next]?.focus()
            }}
            className={cn(
              'flex items-start gap-3 rounded-xl border-[1.5px] text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              size === 'sm' ? 'px-3 py-2' : 'p-3',
              active ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/40',
            )}
          >
            {c.icon && (
              <span
                className={cn(
                  'mt-0.5 flex shrink-0 items-center gap-0.5',
                  active ? 'text-primary-ink' : 'text-muted-foreground',
                )}
              >
                {c.icon}
              </span>
            )}
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-sm font-semibold',
                  active ? 'text-primary-ink' : 'text-foreground',
                )}
              >
                {c.label}
              </span>
              {c.hint && (
                <span className="mt-0.5 block text-xs text-muted-foreground">{c.hint}</span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
