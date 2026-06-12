import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Rediriger vers /login sur l'origine de l'app (pas l'URL Supabase)
  return NextResponse.redirect(new URL("/login", request.url));
}
