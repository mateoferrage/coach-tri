import Link from 'next/link'
import { ACCENT, ACCENT_FG, TEXT_FAINT, TEXT_MUTED } from '@/lib/theme'

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <div className="space-y-2">
        <p className="text-xs font-black uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
          Erreur 404
        </p>
        <h1 className="text-3xl font-black">Page introuvable</h1>
        <p className="max-w-md text-sm" style={{ color: TEXT_MUTED }}>
          La page que tu cherches n&apos;existe pas ou a été déplacée.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-xl px-5 py-2.5 text-sm font-bold"
        style={{ backgroundColor: ACCENT, color: ACCENT_FG }}
      >
        Retour au tableau de bord
      </Link>
    </div>
  )
}
