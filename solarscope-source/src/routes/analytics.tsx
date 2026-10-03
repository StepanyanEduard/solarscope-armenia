import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/bits";
import { CATEGORIES, CATEGORY_LABEL, STATUSES, STATUS_HEX, STATUS_LABEL, byPriority, datasetQuery, kpis, statusFor } from "@/lib/monitoring";

export const Route = createFileRoute("/analytics")({
  loader: ({ context }) => context.queryClient.ensureQueryData(datasetQuery),
  head: () => ({
    meta: [
      { title: "National Analytics — SolarScope Armenia" },
      { name: "description", content: "Condition distribution, problems by province and category, and condition trend across Armenia's solar stations." },
      { property: "og:title", content: "National Analytics — SolarScope Armenia" },
      { property: "og:description", content: "National-level view of Armenian solar station condition and problems." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data } = useSuspenseQuery(datasetQuery);
  const nav = useNavigate();
  const st = data.stations;
  const k = kpis(st);
  const provinces = data.provinces.map((p) => {
    const list = st.filter((s) => s.province_id === p.id);
    const kk = kpis(list);
    return { name: p.name, n: list.length, problems: list.reduce((t, s) => t + s.problems.length, 0), critical: kk.critical, avg: kk.avgCondition, mw: kk.capacity };
  }).sort((a, b) => b.problems - a.problems);
  const maxP = Math.max(1, ...provinces.map((p) => p.problems));
  const cats = CATEGORIES.map((c) => ({ c, n: st.reduce((t, s) => t + s.problems.filter((p) => p.category === c).length, 0) }));
  const maxC = Math.max(1, ...cats.map((c) => c.n));
  const dates = [...new Set(st.flatMap((s) => s.observations.map((o) => o.observed_at)))].sort();
  const trend = dates.map((d) => {
    const v = st.flatMap((s) => s.observations.filter((o) => o.observed_at === d).map((o) => o.condition_score));
    return { d, avg: v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0 };
  });
  const top = byPriority(st).slice(0, 5);

  return (
    <div className="min-h-screen bg-base">
      <AppHeader />
      <main className="mx-auto max-w-[1300px] space-y-3 p-4">
        <div>
          <h1 className="text-[26px] font-bold uppercase">National analytics</h1>
          <p className="text-dim">Click any bar to open the map with that filter applied.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel title="Status distribution">
            <div className="flex h-5 w-full overflow-hidden">
              {STATUSES.map((s) => (k[s] ? <div key={s} style={{ width: `${(k[s] / k.total) * 100}%`, backgroundColor: STATUS_HEX[s] }} title={`${STATUS_LABEL[s]} ${k[s]}`} /> : null))}
            </div>
            <ul className="mt-3 space-y-1">
              {STATUSES.map((s) => (
                <li key={s}>
                  <button onClick={() => nav({ to: "/", search: { status: s } })} className="flex w-full items-center justify-between px-1 py-1 hover:bg-raised">
                    <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_HEX[s] }} />{STATUS_LABEL[s]}</span>
                    <span className="font-mono">{k[s]} <span className="text-dim">({Math.round((k[s] / k.total) * 100)}%)</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Problems by category">
            <ul className="space-y-2">
              {cats.map(({ c, n }) => (
                <li key={c}>
                  <button onClick={() => nav({ to: "/", search: { category: c } })} className="w-full text-left hover:opacity-80">
                    <div className="flex justify-between text-[12px]"><span>{CATEGORY_LABEL[c]}</span><span className="font-mono">{n}</span></div>
                    <div className="mt-1 h-2 bg-raised"><div className="h-full bg-solar" style={{ width: `${(n / maxC) * 100}%` }} /></div>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Average condition trend">
            <svg viewBox="0 0 300 140" className="w-full">
              {trend.map((t, i) => {
                const x = 20 + (i / Math.max(1, trend.length - 1)) * 260;
                const y = 120 - (t.avg / 100) * 105;
                return (
                  <g key={t.d}>
                    <rect x={x - 12} y={y} width={24} height={120 - y} fill={STATUS_HEX[statusFor(t.avg, false)]} opacity={0.75} />
                    <text x={x} y={y - 4} textAnchor="middle" fontSize="10" fill="currentColor">{t.avg}</text>
                    <text x={x} y={134} textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.55}>{new Date(t.d + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</text>
                  </g>
                );
              })}
            </svg>
            <p className="text-[11px] text-dim">Mean condition across all stations per observation pass.</p>
          </Panel>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
          <Panel title="Provinces">
            <table className="w-full text-left">
              <thead className="label-caps"><tr><th className="py-1">Province</th><th>Stations</th><th>Capacity</th><th>Avg cond.</th><th>Critical</th><th className="w-[35%]">Problems</th></tr></thead>
              <tbody>
                {provinces.map((p) => (
                  <tr key={p.name} onClick={() => nav({ to: "/", search: { province: p.name } })} className="cursor-pointer border-t border-line/60 hover:bg-raised">
                    <td className="py-1.5 font-semibold">{p.name}</td>
                    <td className="font-mono">{p.n}</td>
                    <td className="font-mono">{Math.round(p.mw)} MW</td>
                    <td className="font-mono" style={{ color: p.avg != null ? STATUS_HEX[statusFor(p.avg, false)] : undefined }}>{p.avg ?? "—"}</td>
                    <td className={`font-mono ${p.critical ? "text-critical" : "text-dim"}`}>{p.critical}</td>
                    <td><div className="flex items-center gap-2"><div className="h-2 flex-1 bg-raised"><div className="h-full bg-degraded" style={{ width: `${(p.problems / maxP) * 100}%` }} /></div><span className="w-5 font-mono">{p.problems}</span></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel title="Top 5 inspection priorities">
            <ol className="space-y-1">
              {top.map((s, i) => (
                <li key={s.id}>
                  <button onClick={() => nav({ to: "/", search: { station: s.id } })} className="flex w-full items-center gap-2 px-1 py-1.5 text-left hover:bg-raised">
                    <span className="w-4 font-mono text-dim">{i + 1}</span>
                    <span className="flex-1 truncate font-semibold">{s.name}</span>
                    <span className="text-[11px] text-dim">{s.provinceName}</span>
                    <span className="font-mono" style={{ color: STATUS_HEX[s.status] }}>{s.stale ? "?" : s.condition}</span>
                  </button>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </main>
    </div>
  );
}
