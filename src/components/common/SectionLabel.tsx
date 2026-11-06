import { cn } from '@/lib/utils/cn'

interface SectionLabelProps {
  as?: 'h2' | 'h3' | 'p'
  id?: string
  className?: string
  children: React.ReactNode
}

/** Petit intitulé de section : capitales 12 px, bleu lisible (spec Élan). */
export function SectionLabel({ as: Tag = 'h2', id, className, children }: SectionLabelProps) {
  return (
    <Tag
      id={id}
      className={cn(
        'font-sans text-xs font-bold tracking-[0.1em] text-primary-ink uppercase [font-stretch:100%]',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
