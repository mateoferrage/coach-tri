import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Erreur 404</p>
        <h1 className="text-3xl md:text-4xl">Page introuvable</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          La page que tu cherches n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants({ variant: 'highlight' })}>
        Retour au tableau de bord
      </Link>
    </div>
  )
}
