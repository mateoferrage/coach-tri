import { ACCENT, TEXT_FAINT } from '@/lib/theme'

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-transparent"
        style={{ borderTopColor: ACCENT, borderRightColor: ACCENT }}
      />
      <p className="text-xs font-black uppercase tracking-widest" style={{ color: TEXT_FAINT }}>
        Chargement…
      </p>
    </div>
  )
}
