"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register" | "forgot";
const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters").optional(),
});
const copy = {
  login: { title: "Sign in to LifeOS", cta: "Sign in", alt: ["No account?", "Create one", "/register"] },
  register: { title: "Create your account", cta: "Create account", alt: ["Have an account?", "Sign in", "/login"] },
  forgot: { title: "Reset your password", cta: "Send reset link", alt: ["Remembered it?", "Sign in", "/login"] },
} as const;

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const c = copy[mode];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    try { await submit(e); } catch {
      setError("Could not reach Supabase. Check NEXT_PUBLIC_SUPABASE_URL (https://YOUR-REF.supabase.co) in .env.local, then restart the dev server.");
      setBusy(false);
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setNotice(null);
    const f = new FormData(e.currentTarget);
    const parsed = schema.safeParse({ email: f.get("email"), password: mode === "forgot" ? undefined : f.get("password") });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const { email, password } = parsed.data;
    setBusy(true);
    const db = createClient();
    const origin = window.location.origin;
    if (mode === "login") {
      const { error } = await db.auth.signInWithPassword({ email, password: password! });
      if (error) setError("Email or password is incorrect."); else { router.push("/dashboard"); router.refresh(); }
    } else if (mode === "register") {
      const { data, error } = await db.auth.signUp({
        email, password: password!, options: { data: { full_name: f.get("name") }, emailRedirectTo: `${origin}/dashboard` },
      });
      if (error) setError(error.message);
      else if (data.session) { router.push("/dashboard"); router.refresh(); }
      else setNotice("Check your email to confirm your account, then sign in.");
    } else {
      const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/login` });
      if (error) setError("Could not send the reset link. Try again."); else setNotice("If that email has an account, a reset link is on its way.");
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen grid place-items-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-panel border border-line rounded-lg p-6 space-y-4" noValidate>
        <h1 className="text-2xl font-bold">{c.title}</h1>
        {mode === "register" && (
          <label className="block text-sm">Name<input name="name" className="input mt-1" autoComplete="name" /></label>
        )}
        <label className="block text-sm">Email<input name="email" type="email" className="input mt-1" autoComplete="email" required /></label>
        {mode !== "forgot" && (
          <label className="block text-sm">Password
            <input name="password" type="password" className="input mt-1" autoComplete={mode === "login" ? "current-password" : "new-password"} required />
          </label>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="text-sm text-accent">{notice}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : c.cta}</button>
        <div className="text-sm text-muted flex justify-between">
          <span>{c.alt[0]} <Link href={c.alt[2]} className="text-accent underline">{c.alt[1]}</Link></span>
          {mode === "login" && <Link href="/forgot-password" className="underline">Forgot password?</Link>}
        </div>
      </form>
    </main>
  );
}
