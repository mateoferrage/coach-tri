import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

interface LogoProps {
  className?: string
  /** `light` : texte blanc (sur fond bleu). `dark` : texte bleu nuit (sur fond clair). */
  tone?: 'light' | 'dark'
  /** Lien vers cette route ; sans `href`, le logo n'est pas cliquable. */
  href?: string
}

/** Logo Élan : « COACH/TRI », Archivo élargi, barre oblique rouge. */
export function Logo({ className, tone = 'light', href }: LogoProps) {
  const content = (
    <>
      COACH<span className="text-highlight">/</span>TRI
    </>
  )
  const cls = cn(
    'font-display leading-none font-extrabold tracking-[-0.02em] [font-stretch:125%]',
    tone === 'light' ? 'text-primary-foreground' : 'text-foreground',
    className,
  )
  return href ? (
    <Link href={href} className={cls}>
      {content}
    </Link>
  ) : (
    <span className={cls}>{content}</span>
  )
}
