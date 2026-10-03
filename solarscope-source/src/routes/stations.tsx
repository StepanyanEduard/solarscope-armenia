import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { StatusBadge, VerificationTag } from "@/components/bits";
import { CATEGORY_LABEL, STATUS_HEX, datasetQuery, fmtDate, fmtMw, type Station } from "@/lib/monitoring";

export const Route = createFileRoute("/stations")({
  loader: ({ context }) => context.queryClient.ensureQueryData(datasetQuery),
  head: () => ({
    meta: [
      { title: "Station Registry — SolarScope Armenia" },
      { name: "description", content: "Sortable registry of Armenian solar stations with condition, problems, alerts, capacity and inspection priority." },
      { property: "og:title", content: "Station Registry — SolarScope Armenia" },
      { property: "og:description", content: "Every monitored Armenian solar station, ranked by inspection priority." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StationsPage,
});

type Key = "priority" | "condition" | "capacity" | "name" | "province" | "change" | "observed";
const getters: Record<Key, (s: Station) => number | string> = {
  priority: (s) => s.priority,
  condition: (s) => (s.stale ? -1 : s.condition ?? -1),
  capacity: (s) => Number(s.capacity_mw ?? 0),
  name: (s) => s.name,
  province: (s) => s.provinceName,
  change: (s) => s.change ?? 0,
  observed: (s) => s.latest?.observed_at ?? "",
};

function StationsPage() {
  const { data } = useSuspenseQuery(datasetQuery);
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "priority", dir: -1 });
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const t = q.toLowerCase();
    const g = getters[sort.k];
    return data.stations
      .filter((s) => !t || `${s.name} ${s.id} ${s.provinceName} ${s.operator ?? ""}`.toLowerCase().includes(t))
      .sort((a, b) => {
        const x = g(a), y = g(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [data, sort, q]);
  const H = ({ k, children, className = "" }: { k: Key; children: React.ReactNode; className?: string }) => (
    <th className={`px-2 py-2 ${className}`}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? ((-s.dir) as 1 | -1) : -1 }))} className={`label-caps hover:text-ink ${sort.k === k ? "!text-solar" : ""}`}>
        {children}{sort.k === k ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
  return (
    <div className="min-h-screen bg-base">
      <AppHeader />
      <main className="mx-auto max-w-[1400px] p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-bold uppercase">Station registry</h1>
            <p className="text-dim">{data.stations.length} stations · sorted by inspection priority by default</p>
          </div>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, ID, province…" className="w-64 border border-line bg-surface px-2.5 py-1.5 focus:border-solar/60 focus:outline-none" />
        </div>
        <div className="overflow-x-auto border border-line bg-surface">
          <table className="w-full text-left">
            <thead className="border-b border-line">
              <tr>
                <H k="priority">#</H>
                <H k="name">Station</H>
                <H k="province">Province</H>
                <th className="px-2 label-caps">Status</th>
                <H k="condition" className="text-right">Condition</H>
                <H k="change" className="text-right">Change</H>
                <th className="px-2 label-caps">Problems</th>
                <th className="px-2 label-caps">Alerts</th>
                <H k="capacity" className="text-right">Capacity</H>
                <H k="observed">Last obs.</H>
                <th className="px-2 label-caps">Data</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-line/50 hover:bg-raised">
                  <td className="px-2 py-1.5 font-mono text-dim">{s.priority}</td>
                  <td className="px-2">
                    <Link to="/" search={{ station: s.id }} className="font-semibold hover:text-solar">{s.name}</Link>
                    <div className="font-mono text-[10px] text-dim">{s.id}</div>
                  </td>
                  <td className="px-2">{s.provinceName}</td>
                  <td className="px-2"><StatusBadge status={s.status} /></td>
                  <td className="px-2 text-right font-mono" style={{ color: STATUS_HEX[s.status] }}>{s.stale ? "—" : s.condition}</td>
                  <td className={`px-2 text-right font-mono ${s.change != null && s.change < -10 ? "text-critical" : "text-dim"}`}>{s.change == null ? "—" : `${s.change > 0 ? "+" : ""}${s.change}`}</td>
                  <td className="max-w-[220px] truncate px-2 text-[11px] text-dim">{s.problems.map((p) => CATEGORY_LABEL[p.category]).join(", ") || "—"}</td>
                  <td className={`px-2 font-mono ${s.activeAlerts.length ? "text-critical" : "text-dim"}`}>{s.activeAlerts.length}</td>
                  <td className="px-2 text-right font-mono">{fmtMw(s.capacity_mw)}</td>
                  <td className="px-2 font-mono text-[11px]">{fmtDate(s.latest?.observed_at)}</td>
                  <td className="px-2"><VerificationTag v={s.verification} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="p-6 text-center text-dim">No stations match this search.</p>}
        </div>
      </main>
    </div>
  );
}
