import { LoginForm } from "@/components/forms/LoginForm";

export const metadata = { title: "Connexion — Coach Tri" };

export default function LoginPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ backgroundColor: "oklch(0.116 0.022 155)" }}
    >
      {/* Subtle topo pattern overlay */}
      <div
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, oklch(0.843 0.165 157) 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="relative w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-black uppercase tracking-widest text-white">
              Coach
            </span>
            <span
              className="text-3xl font-black uppercase tracking-widest"
              style={{ color: "oklch(0.843 0.165 157)" }}
            >
              &nbsp;Tri
            </span>
          </div>
          <p className="text-sm font-medium text-white/40 uppercase tracking-widest">
            Coaching triathlon IA
          </p>
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{
            backgroundColor: "oklch(0.160 0.022 155)",
            boxShadow: "0 0 0 1px oklch(1 0 0 / 8%), 0 20px 40px oklch(0 0 0 / 40%)",
          }}
        >
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/20">
          Propulsé par Gemini 2.5 Flash · Données Garmin
        </p>
      </div>
    </div>
  );
}
