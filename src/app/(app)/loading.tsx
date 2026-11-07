export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-primary" />
      <p className="text-sm font-medium text-muted-foreground">Chargement…</p>
    </div>
  )
}
