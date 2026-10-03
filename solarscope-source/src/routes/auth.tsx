import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — SolarScope Armenia" },
      { name: "description", content: "Sign in to SolarScope Armenia to manage stations, observations, problems and alerts." },
      { property: "og:title", content: "Sign in — SolarScope Armenia" },
      { property: "og:description", content: "Administrator access for SolarScope Armenia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
    setBusy(false);
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) return setMsg("Check your email to confirm your account.");
    nav({ to: "/admin" });
  };
  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) return setMsg(r.error.message);
    if (!r.redirected) nav({ to: "/admin" });
  };
  const input = "w-full border border-line bg-base px-3 py-2 focus:border-solar/60 focus:outline-none";
  return (
    <div className="min-h-screen bg-base">
      <AppHeader />
      <main className="mx-auto mt-16 max-w-sm border border-line bg-surface p-6">
        <h1 className="text-[24px] font-bold uppercase">{mode === "in" ? "Sign in" : "Create account"}</h1>
        <p className="mb-4 text-dim">Viewing the map is open to everyone. Sign in to manage data (admin role required).</p>
        <button onClick={google} className="mb-3 w-full border border-line py-2 hover:bg-raised">Continue with Google</button>
        <form onSubmit={submit} className="space-y-2">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          <input type="password" required minLength={6} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          <button disabled={busy} className="w-full bg-solar py-2 font-semibold text-base disabled:opacity-50">{mode === "in" ? "Sign in" : "Sign up"}</button>
        </form>
        {msg && <p className="mt-3 text-[12px] text-attention">{msg}</p>}
        <button onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 text-[12px] text-dim hover:text-ink">
          {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
        </button>
      </main>
    </div>
  );
}
