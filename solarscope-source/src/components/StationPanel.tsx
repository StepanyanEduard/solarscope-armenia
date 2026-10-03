import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CATEGORY_LABEL, CONFIG, DEMO_LABEL, NA, explain, fmtDate, fmtMw, STATUS_HEX, type Dataset, type Station,
} from "@/lib/monitoring";
import { ConditionChart } from "./ConditionChart";
import { ConditionValue, DemoTag, Row, SeverityTag, StatusBadge, VerificationTag } from "./bits";

const TABS = ["Overview", "Problems", "Evidence", "History", "Alerts"] as const;

function tileFor(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const r = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
  return { x, y };
}

export function StationPanel({ station: s, data, onClose }: { station: Station; data: Dataset; onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [why, setWhy] = useState(false);
  const src = (id: string | null) => data.sources.find((x) => x.id === id)?.name ?? NA;
  const c = STATUS_HEX[s.status];
  const recommended = s.status === "critical" ? "Immediate inspection" : s.problems[0]?.action ?? (s.status === "unknown" ? "Request new observation / verify data feed" : "Continue routine monitoring");
  const z = 16;
  const t = tileFor(s.lat, s.lng, z);

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-hidden border-l border-line bg-surface lg:w-[400px]">
      <div className="border-b border-line p-3" style={{ boxShadow: `inset 3px 0 0 ${c}` }}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] text-dim">{s.id}</p>
            <h2 className="truncate text-[20px] leading-tight font-bold">{s.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Close station panel" className="border border-line px-2 py-0.5 text-dim hover:text-ink">✕</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={s.status} big />
          <VerificationTag v={s.verification} />
          {s.data_mode === "demo" && <DemoTag />}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-px bg-line text-center">
          {[
            ["Condition", <ConditionValue key="c" value={s.stale ? null : s.condition} status={s.status} />],
            ["Capacity", fmtMw(s.capacity_mw)],
            ["Problems", s.problems.length],
            ["Alerts", <span key="a" className={s.activeAlerts.length ? "text-critical" : ""}>{s.activeAlerts.length}</span>],
          ].map(([k, v]) => (
            <div key={k as string} className="bg-raised px-1 py-2">
              <p className="label-caps !text-[9px]">{k}</p>
              <p className="mt-0.5 font-mono text-[14px]">{v}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-dim">{s.provinceName} Province · {s.municipality ?? NA} · Last observation {fmtDate(s.latest?.observed_at)}</p>
      </div>

      <div className="flex border-b border-line">
        {TABS.map((x) => (
          <button key={x} onClick={() => setTab(x)} className={`flex-1 border-b-2 py-2 font-display text-[12px] font-semibold tracking-[0.1em] uppercase ${tab === x ? "border-solar text-ink" : "border-transparent text-dim hover:text-ink"}`}>
            {x}
            {x === "Problems" && s.problems.length > 0 && <span className="ml-1 text-critical">{s.problems.length}</span>}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {tab === "Overview" && (
          <>
            {s.stale && <p className="border border-unknown/40 bg-unknown/10 p-2 text-[12px]">No recent monitoring data available. Last valid observation: {fmtDate(s.latest?.observed_at)}.</p>}
            {s.latest?.quality === "poor" && <p className="border border-attention/40 bg-attention/10 p-2 text-[12px]">Current observation quality is insufficient for condition assessment.</p>}
            <div className="border p-3" style={{ borderColor: `${c}66`, backgroundColor: `${c}12` }}>
              <p className="label-caps">Recommended action</p>
              <p className="mt-1 text-[14px] font-semibold" style={{ color: c }}>{recommended}</p>
              <p className="mt-1 text-[11px] text-dim">Inspection priority: <b className="text-ink">{s.priorityLabel}</b> ({s.priority}/100)</p>
            </div>
            <div className="border border-line p-3">
              <div className="flex items-center justify-between">
                <p className="label-caps">Condition score</p>
                {s.latest && <button onClick={() => setWhy((w) => !w)} className="text-[11px] text-solar hover:underline">{why ? "Hide" : "Why this score?"}</button>}
              </div>
              <p className="mt-1 text-[26px]"><ConditionValue value={s.stale ? null : s.condition} status={s.status} /></p>
              {s.change != null && (
                <p className="text-[12px]">
                  Previous {s.previous!.condition_score} → current {s.latest!.condition_score}{" "}
                  <span className={s.change < 0 ? "text-critical" : "text-healthy"}>({s.change > 0 ? "+" : ""}{s.change} points)</span>
                </p>
              )}
              {why && s.latest && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] text-dim">Contribution of each factor to the score reduction (100 − {s.latest.condition_score}):</p>
                  {explain(s.latest).map((f) => (
                    <div key={f.key} className="flex items-center gap-2 text-[12px]">
                      <span className="w-32 text-dim">{f.key}</span>
                      <div className="h-1.5 flex-1 bg-raised"><div className="h-full bg-solar" style={{ width: `${f.share}%` }} /></div>
                      <span className="w-9 text-right font-mono">{f.share}%</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-dim">Weights: change 35%, anomaly 30%, trend 20%, data quality 15%. Status bands: ≥{CONFIG.status.healthy} healthy, ≥{CONFIG.status.attention} attention, ≥{CONFIG.status.degraded} degraded, below critical.</p>
                </div>
              )}
              <p className="mt-2 text-[10px] text-dim">Monitoring score — not a confirmed engineering fault.</p>
            </div>
            <div className="border border-line px-3 py-1">
              <Row k="Province" v={s.provinceName} />
              <Row k="Municipality" v={s.municipality ?? NA} />
              <Row k="Coordinates" v={<span className="font-mono">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</span>} />
              <Row k="Installed capacity" v={fmtMw(s.capacity_mw)} />
              <Row k="Operator" v={s.operator ?? NA} />
              <Row k="Station type" v={s.station_type} />
              <Row k="Commissioning date" v={s.commissioning_date ? fmtDate(s.commissioning_date) : NA} />
              <Row k="Data quality" v={s.latest ? `${s.latest.quality} · ${s.latest.cloud_cover ?? "?"}% cloud` : NA} />
              <Row k="Verification" v={<VerificationTag v={s.verification} />} />
              <Row k="Station source" v={src(s.source_id)} />
            </div>
          </>
        )}

        {tab === "Problems" && (
          <>
            {s.problems.length === 0 && <p className="py-6 text-center text-dim">No open problems. Station is within expected conditions.</p>}
            {s.problems.map((p) => (
              <div key={p.id} className="border border-line" style={{ boxShadow: `inset 3px 0 0 ${STATUS_HEX[p.severity === "low" ? "healthy" : p.severity === "medium" ? "attention" : p.severity === "high" ? "degraded" : "critical"]}` }}>
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <p className="font-semibold">{CATEGORY_LABEL[p.category]}</p>
                  <SeverityTag severity={p.severity} />
                </div>
                <div className="px-3 py-2 text-[12px]">
                  <p>{p.description}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div><p className="text-dim">Confidence</p><p className="font-mono">{p.confidence}%</p></div>
                    <div><p className="text-dim">Detected</p><p className="font-mono">{fmtDate(p.detected_at)}</p></div>
                    <div><p className="text-dim">Affected area</p><p className="font-mono">{p.affected_pct != null ? `${p.affected_pct}% of area` : NA}</p></div>
                  </div>
                  <p className="mt-2 text-solar">→ {p.action}</p>
                  <p className="mt-1 text-[10px] text-dim">Stage: {p.status === "confirmed" ? "Confirmed issue" : "Detection — not confirmed"}{p.is_demo ? " · simulated finding" : ""}</p>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === "Evidence" && (
          <>
            <div className="border border-line p-3">
              <p className="label-caps">Satellite observation evidence</p>
              <p className="mt-2 text-[12px]">Satellite evidence unavailable for this observation.</p>
              <p className="mt-1 text-[11px] text-dim">Current/previous observation imagery and change overlays are not ingested yet. Monitoring values for this station are {s.data_mode === "demo" ? "simulated (Demo Observation)" : "from the listed source"}.</p>
            </div>
            <div className="border border-line">
              <p className="label-caps border-b border-line px-3 py-2">Reference location imagery</p>
              <div className="relative">
                <div className="grid grid-cols-2">
                  {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([dx, dy]) => (
                    <img
                      key={`${dx}${dy}`}
                      src={`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${t.y + dy! - 0}/${t.x + dx! - 0}`}
                      alt=""
                      className="block w-full"
                      loading="lazy"
                    />
                  ))}
                </div>
                <span className="pointer-events-none absolute top-1/2 left-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-solar" />
              </div>
              <p className="px-3 py-2 text-[10px] text-dim">Esri World Imagery basemap near the recorded coordinates (approximate). Capture date unknown — this is not the monitoring observation and is not used for the score.</p>
            </div>
          </>
        )}

        {tab === "History" && (
          <>
            <div className="border border-line p-3">
              <p className="label-caps">Condition history</p>
              <ConditionChart observations={s.observations} />
              {(() => {
                const o = s.observations;
                if (o.length < 2) return null;
                const last = o.at(-1)!;
                const ref = [...o].reverse().find((x) => (Date.parse(last.observed_at) - Date.parse(x.observed_at)) / 86400000 >= 28) ?? o[0]!;
                const d = last.condition_score - ref.condition_score;
                return (
                  <p className={`mt-1 text-[12px] ${d <= -CONFIG.significantDrop ? "text-critical" : "text-dim"}`}>
                    Condition {d < 0 ? "decreased" : d > 0 ? "increased" : "unchanged"} by {Math.abs(d)} points since {fmtDate(ref.observed_at)}.
                  </p>
                );
              })()}
            </div>
            <div className="grid grid-cols-3 gap-px bg-line text-center">
              <div className="bg-raised p-2"><p className="label-caps !text-[9px]">Previous</p><p className="font-mono text-[16px]">{s.previous?.condition_score ?? "—"}</p><p className="text-[10px] text-dim">{fmtDate(s.previous?.observed_at)}</p></div>
              <div className="bg-raised p-2"><p className="label-caps !text-[9px]">Current</p><p className="font-mono text-[16px]" style={{ color: c }}>{s.latest?.condition_score ?? "—"}</p><p className="text-[10px] text-dim">{fmtDate(s.latest?.observed_at)}</p></div>
              <div className="bg-raised p-2"><p className="label-caps !text-[9px]">Change</p><p className={`font-mono text-[16px] ${s.change != null && s.change < 0 ? "text-critical" : ""}`}>{s.change == null ? "—" : `${s.change > 0 ? "+" : ""}${s.change}`}</p><p className="text-[10px] text-dim">points</p></div>
            </div>
            <table className="w-full text-[12px]">
              <thead className="text-left text-dim"><tr><th className="py-1">Date</th><th>Score</th><th>Quality</th><th>Source</th></tr></thead>
              <tbody>
                {[...s.observations].reverse().map((o) => (
                  <tr key={o.id} className="border-t border-line/60">
                    <td className="py-1 font-mono">{fmtDate(o.observed_at)}</td>
                    <td className="font-mono">{o.condition_score}</td>
                    <td>{o.quality}</td>
                    <td className="text-dim">{o.is_demo ? "Demo observation" : src(o.source_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "Alerts" && (
          <>
            {s.alerts.length === 0 && <p className="py-6 text-center text-dim">No alerts for this station.</p>}
            {s.alerts.map((a) => (
              <div key={a.id} className={`border border-line p-3 ${a.status === "resolved" ? "opacity-55" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{a.title}</p>
                  <SeverityTag severity={a.severity} />
                </div>
                <p className="mt-1 text-[12px]">{a.message}</p>
                <p className="mt-1 text-[11px] text-dim">{fmtDate(a.created_at)} · {a.status === "active" ? "Active" : "Resolved"} · Action: <span className="text-ink">{a.action}</span></p>
              </div>
            ))}
            <Link to="/alerts" className="block text-center text-[12px] text-solar">Open Alert Center →</Link>
          </>
        )}
      </div>
      <p className="border-t border-line px-3 py-1.5 text-[10px] text-dim">{DEMO_LABEL}: condition scores, history, findings and alerts are simulated.</p>
    </aside>
  );
}
