'use client'

import { MessageCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils/cn'
import { useCoachDrawer } from './CoachDrawer'

interface AskCoachButtonProps {
  /** Texte placé dans le champ du coach à l'ouverture. */
  prefill: string
  /** `blue` : bouton contour blanc posé sur fond bleu. */
  tone?: 'blue' | 'white'
  className?: string
}

export function AskCoachButton({ prefill, tone = 'white', className }: AskCoachButtonProps) {
  const { open } = useCoachDrawer()
  return (
    <button
      type="button"
      onClick={() => open(prefill)}
      className={cn(
        buttonVariants({ variant: 'outline-primary', size: 'lg' }),
        'font-bold',
        tone === 'blue' &&
          'border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-ink',
        className,
      )}
    >
      <MessageCircle />
      Demander au coach
    </button>
  )
}
