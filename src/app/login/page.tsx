import { LoginForm } from '@/components/forms/LoginForm'

export const metadata = { title: 'Connexion — Coach Tri' }

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      {/* Filigrane topographique — signature DA Sommet */}
      <div className="topo-lines absolute inset-0 opacity-[0.03] pointer-events-none" />
      {/* Halo teal doux en bas (lagune) */}
      <div
        className="absolute -bottom-40 left-1/2 -translate-x-1/2 h-96 w-[40rem] rounded-full blur-3xl pointer-events-none"
        style={{
          background: 'radial-gradient(circle, oklch(0.546 0.094 183.4 / 16%), transparent 70%)',
        }}
      />

      <div className="relative w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1 font-[family-name:var(--font-display)]">
            <span className="text-4xl font-semibold uppercase tracking-[0.18em] text-foreground">
              Coach
            </span>
            <span className="text-4xl font-semibold uppercase tracking-[0.18em] text-primary">
              &nbsp;Tri
            </span>
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.25em]">
            Coaching triathlon IA
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl border border-border bg-card p-8 space-y-6"
          style={{ boxShadow: '0 18px 48px oklch(0.287 0.047 217.9 / 14%)' }}
        >
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60">
          Propulsé par Gemini 2.5 Flash · Données Garmin
        </p>
      </div>
    </div>
  )
}
