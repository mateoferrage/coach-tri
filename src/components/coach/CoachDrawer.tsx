'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import CoachChat from './CoachChat'

interface CoachDrawerContextValue {
  /** Ouvre le tiroir ; `prefill` remplit le champ de saisie. */
  open: (prefill?: string) => void
}

const CoachDrawerContext = createContext<CoachDrawerContextValue | null>(null)

export function useCoachDrawer(): CoachDrawerContextValue {
  const ctx = useContext(CoachDrawerContext)
  if (!ctx) throw new Error('useCoachDrawer doit être utilisé dans <CoachDrawerProvider>')
  return ctx
}

const BASE_SUGGESTIONS = [
  'Adapter ma semaine',
  "Je suis fatigué aujourd'hui",
  'Que manger avant ma séance ?',
]

function suggestionsFor(pathname: string): string[] {
  return pathname.startsWith('/session/')
    ? ['Parler de cette séance', ...BASE_SUGGESTIONS]
    : BASE_SUGGESTIONS
}

export function CoachDrawerProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [prefill, setPrefill] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const open = useCallback((text?: string) => {
    setPrefill(text ?? '')
    setIsOpen(true)
  }, [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <CoachDrawerContext.Provider value={value}>
      {children}

      <Dialog.Root
        open={isOpen}
        onOpenChange={(next) => {
          setIsOpen(next)
          if (!next) setPrefill('')
        }}
      >
        <Dialog.Trigger className="fixed right-5 bottom-[calc(4.75rem_+_env(safe-area-inset-bottom))] z-40 flex items-center gap-2.5 rounded-full bg-highlight py-3.5 pr-5 pl-4 text-[15px] font-bold text-highlight-foreground shadow-[0_12px_28px_-10px_oklch(0.555_0.188_32.7/70%)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-foreground md:right-6 md:bottom-6">
          <span className="size-2.5 rounded-full bg-highlight-foreground shadow-[0_0_0_3px_oklch(1_0_0/35%)]" />
          Coach
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-[oklch(0.213_0.038_251.4/30%)] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
          <Dialog.Popup
            initialFocus={inputRef}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-card pt-[env(safe-area-inset-top)] shadow-[-20px_0_50px_-20px_oklch(0.213_0.038_251.4/40%)] transition-transform duration-250 ease-out outline-none data-ending-style:translate-x-full data-starting-style:translate-x-full motion-reduce:transition-none md:w-[400px]"
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <Dialog.Title className="text-xs font-bold tracking-[0.1em] text-primary-ink uppercase">
                  Ton coach
                </Dialog.Title>
                <Dialog.Description className="text-xs text-muted-foreground">
                  Répond à partir de ton plan
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Fermer"
                className="flex size-8 items-center justify-center rounded-full bg-accent text-primary-ink hover:bg-secondary"
              >
                <X size={16} strokeWidth={2.5} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1">
              <CoachChat
                key={prefill}
                initialInput={prefill}
                suggestions={suggestionsFor(pathname)}
                inputRef={inputRef}
              />
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </CoachDrawerContext.Provider>
  )
}
