import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { Panel, StatusBadge } from "@/components/bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CATEGORIES, CATEGORY_LABEL, SEVERITIES, datasetQuery, fmtDate } from "@/lib/monitoring";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — SolarScope Armenia" },
      { name: "description", content: "Administer stations, observations, problems and alerts for SolarScope Armenia." },
      { property: "og:title", content: "Admin — SolarScope Armenia" },
      { property: "og:description", content: "Data management for SolarScope Armenia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const input = "w-full border border-line bg-base px-2 py-1.5 text-[12px] focus:border-solar/60 focus:outline-none";

function AdminPage() {
  const { user, isAdmin, loading, signOut } = useAuth();
  const { data } = useQuery(datasetQuery);
  const qc = useQueryClient();
  const [stationId, setStationId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["dataset"] });
  const done = (error: { message: string } | null, ok: string) => {
    setMsg(error ? `Error: ${error.message}` : ok);
    if (!error) refresh();
  };

  if (loading) return <Shell><p className="text-dim">Checking access…</p></Shell>;
  if (!user) return <Shell><p>Sign in to access administration. <Link to="/auth" className="text-solar">Sign in →</Link></p></Shell>;
  if (!isAdmin)
    return (
      <Shell>
        <p>Signed in as {user.email}, but this account does not have the admin role.</p>
        <p className="mt-1 text-dim">Ask the project owner to grant admin access.</p>
        <button onClick={signOut} className="mt-3 border border-line px-3 py-1">Sign out</button>
      </Shell>
    );
  if (!data) return <Shell><p className="text-dim">Loading…</p></Shell>;
  const st = data.stations.find((s) => s.id === stationId);

  return (
    <Shell>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-dim">Admin: {user.email}</p>
        <button onClick={signOut} className="border border-line px-3 py-1 text-[12px]">Sign out</button>
      </div>
      {msg && <p className="mb-3 border border-line bg-raised p-2 text-[12px]">{msg}</p>}
      <Panel title="Select station">
        <select value={stationId} onChange={(e) => setStationId(e.target.value)} className={input}>
          <option value="">— choose a station —</option>
          {data.stations.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
        </select>
      </Panel>
      {st && (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Panel title="Station metadata" right={<StatusBadge status={st.status} />}>
            <form
              key={st.id}
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const { error } = await supabase.from("stations").update({
                  name: String(f.get("name")),
                  operator: String(f.get("operator")) || null,
                  capacity_mw: f.get("capacity") ? Number(f.get("capacity")) : null,
                  verification: String(f.get("verification")),
                  data_mode: String(f.get("mode")),
                }).eq("id", st.id);
                done(error, "Station updated.");
              }}
            >
              <L t="Name"><input name="name" defaultValue={st.name} className={input} /></L>
              <L t="Operator"><input name="operator" defaultValue={st.operator ?? ""} className={input} /></L>
              <L t="Capacity (MW)"><input name="capacity" type="number" step="0.1" defaultValue={st.capacity_mw ?? ""} className={input} /></L>
              <L t="Verification">
                <select name="verification" defaultValue={st.verification} className={input}>{["verified", "unverified", "estimated", "demo"].map((v) => <option key={v}>{v}</option>)}</select>
              </L>
              <L t="Data mode">
                <select name="mode" defaultValue={st.data_mode} className={input}><option>demo</option><option>real</option></select>
              </L>
              <button className="bg-solar px-3 py-1.5 font-semibold text-base">Save</button>
            </form>
          </Panel>
          <Panel title="Add observation">
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const score = Number(f.get("score"));
                const risk = 100 - score;
                const { error } = await supabase.from("observations").insert({
                  station_id: st.id,
                  observed_at: String(f.get("date")),
                  condition_score: score,
                  f_change: risk, f_anomaly: risk, f_trend: risk, f_quality: f.get("quality") === "poor" ? 60 : 10,
                  quality: String(f.get("quality")),
                  is_demo: false,
                });
                done(error, "Observation added.");
              }}
            >
              <L t="Date"><input name="date" type="date" required className={input} /></L>
              <L t="Condition score (0–100)"><input name="score" type="number" min={0} max={100} required className={input} /></L>
              <L t="Quality"><select name="quality" className={input}><option>good</option><option>fair</option><option>poor</option></select></L>
              <button className="bg-solar px-3 py-1.5 font-semibold text-base">Add</button>
            </form>
          </Panel>
          <Panel title="Add problem">
            <form
              className="space-y-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const { error } = await supabase.from("problems").insert({
                  station_id: st.id,
                  category: String(f.get("category")),
                  severity: String(f.get("severity")),
                  description: String(f.get("description")),
                  action: String(f.get("action")),
                  confidence: Number(f.get("confidence")),
                  is_demo: false,
                });
                done(error, "Problem added.");
              }}
            >
              <L t="Category"><select name="category" className={input}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select></L>
              <L t="Severity"><select name="severity" className={input}>{SEVERITIES.map((c) => <option key={c}>{c}</option>)}</select></L>
              <L t="Description"><input name="description" required className={input} /></L>
              <L t="Recommended action"><input name="action" className={input} /></L>
              <L t="Confidence %"><input name="confidence" type="number" min={0} max={100} defaultValue={70} className={input} /></L>
              <button className="bg-solar px-3 py-1.5 font-semibold text-base">Add</button>
            </form>
          </Panel>
          <Panel title="Problems & alerts">
            <ul className="space-y-1.5">
              {st.problems.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 border-b border-line/50 pb-1">
                  <span className="text-[12px]">{CATEGORY_LABEL[p.category]} · {p.severity}</span>
                  <span className="flex gap-1">
                    {p.status !== "confirmed" && <button onClick={async () => done((await supabase.from("problems").update({ status: "confirmed" }).eq("id", p.id)).error, "Problem confirmed.")} className="border border-line px-2 text-[11px]">Confirm</button>}
                    <button onClick={async () => done((await supabase.from("problems").update({ status: "resolved" }).eq("id", p.id)).error, "Problem resolved.")} className="border border-line px-2 text-[11px]">Resolve</button>
                  </span>
                </li>
              ))}
              {st.activeAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 border-b border-line/50 pb-1">
                  <span className="text-[12px]">Alert: {a.title} · {fmtDate(a.created_at)}</span>
                  <button onClick={async () => done((await supabase.from("alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", a.id)).error, "Alert resolved.")} className="border border-line px-2 text-[11px]">Resolve</button>
                </li>
              ))}
              {!st.problems.length && !st.activeAlerts.length && <li className="text-dim">No open problems or active alerts.</li>}
            </ul>
          </Panel>
        </div>
      )}
    </Shell>
  );
}

function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <label className="block"><span className="label-caps !text-[10px]">{t}</span>{children}</label>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <AppHeader />
      <main className="mx-auto max-w-5xl p-4">
        <h1 className="mb-3 text-[26px] font-bold uppercase">Administration</h1>
        {children}
      </main>
    </div>
  );
}
