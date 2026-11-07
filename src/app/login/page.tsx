import { Logo } from '@/components/common/Logo'
import { LoginForm } from '@/components/forms/LoginForm'

export const metadata = { title: 'Connexion — Coach Tri' }

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-primary px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-8 py-12">
        <div className="space-y-3 text-center">
          <Logo tone="light" className="text-4xl" />
          <p className="text-base font-semibold text-primary-foreground">
            Ton coach triathlon et trail, piloté par l&apos;IA.
          </p>
        </div>

        <div className="space-y-6 rounded-xl bg-card p-8">
          <LoginForm />
        </div>

        <p className="text-center text-[13px] font-semibold text-primary-foreground">
          Propulsé par Gemini · Données Garmin et Strava
        </p>
      </div>
    </div>
  )
}
