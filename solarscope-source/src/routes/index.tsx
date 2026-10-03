import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ArmeniaMap } from "@/components/ArmeniaMap";
import { StationPanel } from "@/components/StationPanel";
import { StatusBadge } from "@/components/bits";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  CAP_BANDS, CATEGORIES, CATEGORY_LABEL, CONFIG, OBS_BANDS, SEVERITIES, STATUSES, STATUS_HEX, STATUS_LABEL,
  byPriority, datasetQuery, daysBetween, kpis, type CapBand, type ObsBand, type Status,
} from "@/lib/monitoring";

export type MapSearch = {
  station?: string | undefined;
  status?: Status | undefined;
  province?: string | undefined;
  category?: string | undefined;
  severity?: string | undefined;
};

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): MapSearch => {
    const str = (k: string) => (typeof s[k] === "string" && s[k] ? (s[k] as string) : undefined);
    const st = str("status");
    return {
      station: str("station"),
      status: st && (STATUSES as string[]).includes(st) ? (st as Status) : undefined,
      province: str("province"),
      category: str("category"),
      severity: str("severity"),
    };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(datasetQuery),
  head: () => ({
    meta: [
      { title: "Armenia Solar Monitoring Map — SolarScope" },
      { name: "description", content: "National map of Armenian solar stations, color-coded by condition, with active problems, alerts and inspection priority." },
      { property: "og:title", content: "Armenia Solar Monitoring Map — SolarScope" },
      { property: "og:description", content: "See which Armenian solar stations are healthy, which have problems, and which need inspection first." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

function MapPage() {
  const { data } = useSuspenseQuery(datasetQuery);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [caps, setCaps] = useState<CapBand[]>([]);
  const [obs, setObs] = useState<ObsBand | null>(null);
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ lng: number; lat: number } | null>(null);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const set = (patch: Partial<MapSearch>) => navigate({ search: (p) => ({ ...p, ...patch }), replace: true });

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return data.stations.filter((s) => {
      const age = s.latest ? daysBetween(s.latest.observed_at, CONFIG.today) : 9999;
      return (
        (!t || `${s.name} ${s.id} ${s.provinceName} ${s.municipality ?? ""} ${s.operator ?? ""}`.toLowerCase().includes(t)) &&
        (!search.status || s.status === search.status) &&
        (!search.province || s.provinceName === search.province) &&
        (!search.category || s.problems.some((p) => p.category === search.category)) &&
        (!search.severity || s.problems.some((p) => p.severity === search.severity)) &&
        (caps.length === 0 || caps.some((c) => CAP_BANDS.find((b) => b.id === c)!.test(Number(s.capacity_mw ?? 0)))) &&
        (!obs || OBS_BANDS.find((b) => b.id === obs)!.test(age)) &&
        (!alertsOnly || s.activeAlerts.length > 0)
      );
    });
  }, [data, q, search.status, search.province, search.category, search.severity, caps, obs, alertsOnly]);

  const k = kpis(filtered);
  const selected = search.station ? data.stations.find((s) => s.id === search.station) : undefined;
  const queue = byPriority(filtered).filter((s) => s.status !== "healthy").slice(0, 10);
  const suggestions = q.trim().length >= 2 ? filtered.slice(0, 6) : [];
  const anyFilter = !!(search.status || search.province || search.category || search.severity || caps.length || obs || alertsOnly || q);
  const reset = () => {
    setQ(""); setCaps([]); setObs(null); setAlertsOnly(false);
    navigate({ search: (p) => ({ station: p.station }), replace: true });
  };
  const open = (id: string) => { setFocus({ id, n: Date.now() }); set({ station: id }); };
  const chip = (on: boolean) => `px-2 py-1 text-[11px] border transition ${on ? "border-solar/60 bg-solar/10 text-solar" : "border-line text-dim hover:text-ink"}`;

  const KPI: Array<[string, string | number, string | undefined, Status | undefined]> = [
    ["Stations", k.total, undefined, undefined],
    ["Capacity", `${Math.round(k.capacity)} MW`, undefined, undefined],
    ["Healthy", k.healthy, STATUS_HEX.healthy, "healthy"],
    ["Attention", k.attention, STATUS_HEX.attention, "attention"],
    ["Degraded", k.degraded, STATUS_HEX.degraded, "degraded"],
    ["Critical", k.critical, STATUS_HEX.critical, "critical"],
    ["Unknown", k.unknown, STATUS_HEX.unknown, "unknown"],
    ["Active alerts", k.alerts, STATUS_HEX.critical, undefined],
    ["Avg condition", k.avgCondition ?? "—", undefined, undefined],
  ];

  return (
    <div className="flex h-screen flex-col bg-base text-ink">
      <AppHeader />
      <div className="flex shrink-0 gap-px overflow-x-auto border-b border-line bg-line">
        {KPI.map(([label, v, color, st]) => (
          <button
            key={label}
            onClick={() => (st ? set({ status: search.status === st ? undefined : st }) : label === "Active alerts" ? setAlertsOnly((x) => !x) : undefined)}
            className={`min-w-[104px] flex-1 bg-surface px-3 py-2 text-left ${st || label === "Active alerts" ? "hover:bg-raised" : "cursor-default"} ${(st && search.status === st) || (label === "Active alerts" && alertsOnly) ? "!bg-raised shadow-[inset_0_-2px_0_var(--solar)]" : ""}`}
          >
            <p className="font-mono text-[20px] leading-none font-semibold" style={{ color }}>{v}</p>
            <p className="label-caps mt-1 !text-[10px]">{label}</p>
          </button>
        ))}
      </div>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className={`${showFilters ? "flex" : "hidden"} w-full flex-col gap-4 overflow-y-auto border-line bg-surface p-3 lg:flex lg:w-[236px] lg:shrink-0 lg:border-r`}>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search station, ID, province, operator…"
              aria-label="Search stations"
              className="w-full border border-line bg-base px-2.5 py-1.5 text-[12px] focus:border-solar/60 focus:outline-none"
            />
            {suggestions.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-20 border border-line bg-raised">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button onClick={() => { open(s.id); setQ(""); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] hover:bg-surface">
                      <span className="size-2 rounded-full" style={{ backgroundColor: STATUS_HEX[s.status] }} />
                      <span className="flex-1 truncate">{s.name}</span>
                      <span className="font-mono text-[10px] text-dim">{s.id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Group label="Province">
            <select value={search.province ?? ""} onChange={(e) => set({ province: e.target.value || undefined })} className="w-full border border-line bg-base px-2 py-1.5 text-[12px]">
              <option value="">All 11 provinces</option>
              {data.provinces.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </Group>
          <Group label="Status">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => set({ status: search.status === s ? undefined : s })} className={chip(search.status === s)}>
                <span className="mr-1 inline-block size-1.5 rounded-full align-middle" style={{ backgroundColor: STATUS_HEX[s] }} />{STATUS_LABEL[s]}
              </button>
            ))}
          </Group>
          <Group label="Problem type">
            {CATEGORIES.map((c) => <button key={c} onClick={() => set({ category: search.category === c ? undefined : c })} className={chip(search.category === c)}>{CATEGORY_LABEL[c]}</button>)}
          </Group>
          <Group label="Severity">
            {SEVERITIES.map((c) => <button key={c} onClick={() => set({ severity: search.severity === c ? undefined : c })} className={`${chip(search.severity === c)} capitalize`}>{c}</button>)}
          </Group>
          <Group label="Capacity">
            {CAP_BANDS.map((b) => <button key={b.id} onClick={() => setCaps((x) => (x.includes(b.id) ? x.filter((y) => y !== b.id) : [...x, b.id]))} className={chip(caps.includes(b.id))}>{b.label}</button>)}
          </Group>
          <Group label="Observation date">
            {OBS_BANDS.map((b) => <button key={b.id} onClick={() => setObs(obs === b.id ? null : b.id)} className={chip(obs === b.id)}>{b.label}</button>)}
          </Group>
          <div className="mt-auto border-t border-line pt-3">
            <p className="text-[12px]"><span className="font-mono text-solar">{filtered.length}</span> <span className="text-dim">of {data.stations.length} stations</span></p>
            {anyFilter && <button onClick={reset} className="mt-2 w-full border border-line py-1.5 text-[11px] text-dim hover:text-ink">Clear all filters</button>}
          </div>
        </aside>

        <div className="relative min-h-[440px] min-w-0 flex-1">
          <ArmeniaMap
            stations={filtered}
            selectedId={search.station ?? null}
            onSelect={(id) => (id ? open(id) : set({ station: undefined }))}
            focus={focus}
            province={search.province ?? null}
            onProvince={(p) => set({ province: p ?? undefined })}
            picking={adding && !draft}
            onMapClick={adding ? (lng, lat) => setDraft({ lng, lat }) : undefined}
          />
          <button onClick={() => setShowFilters((s) => !s)} className="absolute top-2 left-2 border border-line bg-surface px-3 py-1 text-[12px] lg:hidden">Filters</button>
          {isAdmin && (
            <button
              onClick={() => { setAdding((a) => !a); setDraft(null); setAddMsg(null); }}
              className={`absolute bottom-2 right-2 border px-3 py-1.5 text-[12px] font-semibold ${adding ? "border-solar bg-solar text-base" : "border-line bg-surface text-ink hover:bg-raised"}`}
            >
              {adding ? "Cancel adding" : "+ Add station"}
            </button>
          )}
          {draft && (
            <AddStationForm
              lng={draft.lng}
              lat={draft.lat}
              provinces={data.provinces}
              existing={data.stations.map((s) => s.id)}
              onCancel={() => setDraft(null)}
              onSaved={(id, msg) => {
                setDraft(null); setAdding(false); setAddMsg(msg);
                void qc.invalidateQueries({ queryKey: ["dataset"] }).then(() => open(id));
              }}
            />
          )}
          {addMsg && <div className="absolute bottom-12 right-2 border border-line bg-raised px-3 py-1.5 text-[12px]">{addMsg}</div>}
          {filtered.length === 0 && (
            <div className="absolute inset-x-0 top-14 mx-auto w-fit border border-line bg-raised px-4 py-3 text-[12px]">
              No stations match the selected filters. <button onClick={reset} className="text-solar">Clear filters</button>
            </div>
          )}
        </div>

        {selected ? (
          <StationPanel key={selected.id} station={selected} data={data} onClose={() => set({ station: undefined })} />
        ) : (
          <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-line bg-surface lg:w-[300px] lg:border-l">
            <div className="border-b border-line px-3 py-2.5">
              <h2 className="text-[15px] font-bold tracking-wide uppercase">Inspection priority</h2>
              <p className="text-[10px] text-dim">Condition risk + problem severity + change + capacity, weighted by confidence & data quality</p>
            </div>
            <ol>
              {queue.map((s, i) => (
                <li key={s.id}>
                  <button onClick={() => open(s.id)} className="flex w-full gap-2.5 border-b border-line/60 px-3 py-2.5 text-left hover:bg-raised" style={{ boxShadow: `inset 2px 0 0 ${STATUS_HEX[s.status]}` }}>
                    <span className="w-4 font-mono text-[12px] text-dim">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-semibold">{s.name}</span>
                        <span className="font-mono text-[12px]" style={{ color: STATUS_HEX[s.status] }}>{s.stale ? "?" : s.condition}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[10px] text-dim">
                        <StatusBadge status={s.status} /> {s.provinceName} · {s.priorityLabel}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-dim">
                        {s.problems.length ? s.problems.map((p) => CATEGORY_LABEL[p.category]).join(" · ") : "No open problems"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {queue.length === 0 && <li className="px-3 py-6 text-center text-[12px] text-dim">All stations in this view are healthy.</li>}
            </ol>
          </aside>
        )}
      </main>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label-caps mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function AddStationForm({
  lng,
  lat,
  provinces,
  existing,
  onCancel,
  onSaved,
}: {
  lng: number;
  lat: number;
  provinces: { id: string; name: string }[];
  existing: string[];
  onCancel: () => void;
  onSaved: (id: string, msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = "w-full border border-line bg-base px-2 py-1.5 text-[12px] focus:border-solar/60 focus:outline-none";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const f = new FormData(e.currentTarget);
    const prov = String(f.get("province"));
    const prefix = `AM-${prov.toUpperCase()}-`;
    let seq = 1;
    for (const id of existing) if (id.startsWith(prefix)) seq = Math.max(seq, Number(id.slice(prefix.length)) + 1);
    const id = `${prefix}${String(seq).padStart(3, "0")}`;
    const { error } = await supabase.from("stations").insert({
      id,
      name: String(f.get("name")),
      province_id: prov,
      municipality: String(f.get("municipality")) || null,
      lat,
      lng,
      capacity_mw: f.get("capacity") ? Number(f.get("capacity")) : null,
      operator: String(f.get("operator")) || null,
      station_type: String(f.get("type")),
      verification: "unverified",
      data_mode: "real",
    });
    setBusy(false);
    if (error) setErr(error.message);
    else onSaved(id, `Station ${id} added.`);
  };

  return (
    <div className="absolute inset-x-4 top-14 z-20 mx-auto max-w-sm border border-line bg-surface p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[14px] font-bold uppercase">New station</h3>
        <span className="font-mono text-[11px] text-dim">{lat.toFixed(4)}, {lng.toFixed(4)}</span>
      </div>
      <form onSubmit={submit} className="space-y-2">
        <label className="block"><span className="label-caps !text-[10px]">Name</span><input name="name" required className={input} placeholder="e.g. Garni Solar 1" /></label>
        <label className="block"><span className="label-caps !text-[10px]">Province</span>
          <select name="province" className={input}>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </label>
        <label className="block"><span className="label-caps !text-[10px]">Municipality</span><input name="municipality" className={input} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label-caps !text-[10px]">Capacity (MW)</span><input name="capacity" type="number" step="0.1" min={0} className={input} /></label>
          <label className="block"><span className="label-caps !text-[10px]">Type</span>
            <select name="type" className={input}><option value="utility">Utility</option><option value="commercial">Commercial</option><option value="rooftop">Rooftop</option></select>
          </label>
        </div>
        <label className="block"><span className="label-caps !text-[10px]">Operator</span><input name="operator" className={input} /></label>
        {err && <p className="text-[12px] text-critical">{err}</p>}
        <div className="flex gap-2 pt-1">
          <button disabled={busy} className="bg-solar px-3 py-1.5 text-[12px] font-semibold text-base disabled:opacity-50">{busy ? "Saving…" : "Save station"}</button>
          <button type="button" onClick={onCancel} className="border border-line px-3 py-1.5 text-[12px] text-dim hover:text-ink">Cancel</button>
        </div>
      </form>
    </div>
  );
}
