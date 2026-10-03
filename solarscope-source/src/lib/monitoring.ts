// Monitoring domain layer: reads the station database and derives status, score
// explanation and inspection priority. Every page uses this one data source.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type StationRow = Tables<"stations">;
export type ObservationRow = Tables<"observations">;
export type ProblemRow = Tables<"problems">;
export type AlertRow = Tables<"alerts">;
export type ProvinceRow = Tables<"provinces">;
export type SourceRow = Tables<"data_sources">;

/** Configurable monitoring thresholds. */
export const CONFIG = {
  status: { healthy: 80, attention: 60, degraded: 40 }, // >= healthy, >= attention, >= degraded, else critical
  staleDays: 30, // no valid observation within N days -> unknown / data issue
  significantDrop: 15,
  today: "2026-10-04", // reference date for the demo dataset
};

export type Status = "healthy" | "attention" | "degraded" | "critical" | "unknown";
export const STATUSES: Status[] = ["healthy", "attention", "degraded", "critical", "unknown"];
export const STATUS_LABEL: Record<Status, string> = { healthy: "Healthy", attention: "Attention", degraded: "Degraded", critical: "Critical", unknown: "Unknown" };
export const STATUS_HEX: Record<Status, string> = { healthy: "#3ecf73", attention: "#f2d13a", degraded: "#f08a3c", critical: "#ef4452", unknown: "#7d8896" };

export type Category = ProblemRow["category"];
export const CATEGORIES = ["condition_change", "area_anomaly", "vegetation", "visual_anomaly", "data_issue"] as const;
export const CATEGORY_LABEL: Record<string, string> = {
  condition_change: "Condition change",
  area_anomaly: "Area anomaly",
  vegetation: "Vegetation / obstruction",
  visual_anomaly: "Visual anomaly",
  data_issue: "Data issue",
};
export const SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type Severity = (typeof SEVERITIES)[number];
export const SEVERITY_HEX: Record<string, string> = { critical: "#ef4452", high: "#f08a3c", medium: "#f2d13a", low: "#3ecf73" };
const SEV_W: Record<string, number> = { critical: 40, high: 28, medium: 14, low: 5 };

export const VERIFICATION_LABEL: Record<string, string> = { verified: "Verified", unverified: "Unverified", estimated: "Estimated", demo: "Demo" };
export const DEMO_LABEL = "Demo Monitoring Data";
export const NA = "Not available";

export function statusFor(score: number | null, stale: boolean): Status {
  if (score == null || stale) return "unknown";
  if (score >= CONFIG.status.healthy) return "healthy";
  if (score >= CONFIG.status.attention) return "attention";
  if (score >= CONFIG.status.degraded) return "degraded";
  return "critical";
}

export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : NA;
export const fmtMw = (mw: number | null) => (mw == null ? NA : `${Number(mw) < 1 ? Number(mw).toFixed(1) : Number(mw)} MW`);

export interface Station extends StationRow {
  provinceName: string;
  observations: ObservationRow[]; // oldest -> newest
  latest: ObservationRow | null;
  previous: ObservationRow | null;
  condition: number | null;
  change: number | null;
  status: Status;
  stale: boolean;
  problems: ProblemRow[]; // open only
  alerts: AlertRow[]; // all
  activeAlerts: AlertRow[];
  priority: number;
  priorityLabel: "Immediate" | "High" | "Medium" | "Low";
}

export interface Dataset {
  stations: Station[];
  provinces: ProvinceRow[];
  sources: SourceRow[];
  alerts: (AlertRow & { station: Station })[];
}

function capacityWeight(mw: number | null) {
  if (mw == null) return 2;
  return Math.min(10, Math.log10(Number(mw) + 1) * 4.3);
}

export function buildDataset(rows: {
  stations: StationRow[];
  observations: ObservationRow[];
  problems: ProblemRow[];
  alerts: AlertRow[];
  provinces: ProvinceRow[];
  sources: SourceRow[];
}): Dataset {
  const pname = new Map(rows.provinces.map((p) => [p.id, p.name]));
  const group = <T extends { station_id: string }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const r of list) (m.get(r.station_id) ?? m.set(r.station_id, []).get(r.station_id)!).push(r);
    return m;
  };
  const obs = group(rows.observations);
  const probs = group(rows.problems);
  const alerts = group(rows.alerts);

  const stations: Station[] = rows.stations.map((s) => {
    const o = [...(obs.get(s.id) ?? [])].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
    const latest = o.at(-1) ?? null;
    const previous = o.length > 1 ? o[o.length - 2]! : null;
    const stale = !latest || daysBetween(latest.observed_at, CONFIG.today) > CONFIG.staleDays;
    const condition = latest?.condition_score ?? null;
    const change = latest && previous ? latest.condition_score - previous.condition_score : null;
    const status = statusFor(condition, stale);
    const problems = (probs.get(s.id) ?? []).filter((p) => p.status !== "resolved").sort((a, b) => SEV_W[b.severity]! - SEV_W[a.severity]!);
    const al = [...(alerts.get(s.id) ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    const active = al.filter((a) => a.status === "active");
    // Priority = condition risk + problem severity + change magnitude + asset importance, weighted by confidence and data quality
    const condRisk = condition == null ? 20 : (100 - condition) * 0.5;
    const sev = problems.reduce((t, p) => t + SEV_W[p.severity]! * (p.confidence / 100), 0);
    const chg = change != null && change < 0 ? Math.min(25, -change * 0.6) : 0;
    const qual = latest?.quality === "poor" ? 0.85 : 1;
    const priority = Math.round(Math.min(100, (condRisk + Math.min(40, sev * 0.6) + chg + capacityWeight(s.capacity_mw)) * qual));
    const priorityLabel = status === "critical" || priority >= 60 ? "Immediate" : priority >= 38 ? "High" : priority >= 22 ? "Medium" : "Low";
    return {
      ...s,
      provinceName: pname.get(s.province_id) ?? s.province_id,
      observations: o,
      latest,
      previous,
      condition,
      change,
      status,
      stale,
      problems,
      alerts: al,
      activeAlerts: active,
      priority,
      priorityLabel,
    };
  });
  const byId = new Map(stations.map((s) => [s.id, s]));
  const allAlerts = rows.alerts
    .map((a) => ({ ...a, station: byId.get(a.station_id)! }))
    .filter((a) => a.station)
    .sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1) || SEV_W[b.severity]! - SEV_W[a.severity]! || b.created_at.localeCompare(a.created_at));
  return { stations, provinces: rows.provinces, sources: rows.sources, alerts: allAlerts };
}

async function fetchAll() {
  const [st, ob, pr, al, pv, src] = await Promise.all([
    supabase.from("stations").select("*").order("id"),
    supabase.from("observations").select("*").order("observed_at"),
    supabase.from("problems").select("*"),
    supabase.from("alerts").select("*"),
    supabase.from("provinces").select("*").order("name"),
    supabase.from("data_sources").select("*"),
  ]);
  const err = st.error ?? ob.error ?? pr.error ?? al.error ?? pv.error ?? src.error;
  if (err) throw new Error(err.message);
  return buildDataset({ stations: st.data!, observations: ob.data!, problems: pr.data!, alerts: al.data!, provinces: pv.data!, sources: src.data! });
}

export const datasetQuery = queryOptions({ queryKey: ["dataset"], queryFn: fetchAll, staleTime: 30_000 });

export function kpis(list: Station[]) {
  const c = (s: Status) => list.filter((x) => x.status === s).length;
  return {
    total: list.length,
    healthy: c("healthy"),
    attention: c("attention"),
    degraded: c("degraded"),
    critical: c("critical"),
    unknown: c("unknown"),
    alerts: list.reduce((t, s) => t + s.activeAlerts.length, 0),
    criticalAlerts: list.reduce((t, s) => t + s.activeAlerts.filter((a) => a.severity === "critical").length, 0),
    capacity: list.reduce((t, s) => t + Number(s.capacity_mw ?? 0), 0),
    avgCondition: (() => {
      const v = list.filter((s) => s.condition != null && !s.stale);
      return v.length ? Math.round(v.reduce((t, s) => t + s.condition!, 0) / v.length) : null;
    })(),
  };
}

export const byPriority = (list: Station[]) => [...list].sort((a, b) => b.priority - a.priority);

/** Score explanation: contribution of each factor to the risk (100 − condition). */
export function explain(o: ObservationRow) {
  const parts = [
    { key: "Historical change", w: 0.35, v: o.f_change },
    { key: "Observed anomaly", w: 0.3, v: o.f_anomaly },
    { key: "Recent trend", w: 0.2, v: o.f_trend },
    { key: "Data quality", w: 0.15, v: o.f_quality },
  ];
  const total = parts.reduce((t, p) => t + p.v * p.w, 0) || 1;
  return parts.map((p) => ({ ...p, share: Math.round(((p.v * p.w) / total) * 100) }));
}

export type CapBand = "lt1" | "1-10" | "10-50" | "50+";
export const CAP_BANDS: { id: CapBand; label: string; test: (mw: number) => boolean }[] = [
  { id: "lt1", label: "<1 MW", test: (m) => m < 1 },
  { id: "1-10", label: "1–10 MW", test: (m) => m >= 1 && m < 10 },
  { id: "10-50", label: "10–50 MW", test: (m) => m >= 10 && m < 50 },
  { id: "50+", label: "50+ MW", test: (m) => m >= 50 },
];
export type ObsBand = "latest" | "7" | "30" | "older";
export const OBS_BANDS: { id: ObsBand; label: string; test: (age: number) => boolean }[] = [
  { id: "latest", label: "Latest", test: (a) => a <= 3 },
  { id: "7", label: "Last 7 days", test: (a) => a <= 7 },
  { id: "30", label: "Last 30 days", test: (a) => a <= 30 },
  { id: "older", label: "Older", test: (a) => a > 30 },
];
