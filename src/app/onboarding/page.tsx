import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/forms/OnboardingFlow";

export const metadata = { title: "Configuration — Coach Tri" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("first_name")
    .eq("id", user.id)
    .single() as { data: { first_name: string | null } | null };

  // Already onboarded
  if (profile?.first_name) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Bienvenue sur Coach Tri</h1>
          <p className="mt-2 text-zinc-500">Configurons votre profil en 3 étapes</p>
        </div>
        <OnboardingFlow />
      </div>
    </div>
  );
}
