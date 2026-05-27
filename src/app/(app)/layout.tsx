import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/common/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav user={user} />
      <main className="flex-1 container mx-auto max-w-6xl px-4 py-8 pb-24 md:pb-8">
        {children}
      </main>
    </div>
  );
}
