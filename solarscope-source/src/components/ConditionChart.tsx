import { CONFIG, STATUS_HEX, statusFor, type ObservationRow } from "@/lib/monitoring";

export function ConditionChart({ observations, height = 150 }: { observations: ObservationRow[]; height?: number }) {
  if (observations.length === 0) return <p className="py-6 text-center text-dim">No recent monitoring data available.</p>;
  const W = 360, H = height, pad = { l: 26, r: 8, t: 14, b: 20 };
  const x = (i: number) => pad.l + (observations.length === 1 ? 0 : (i / (observations.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const pts = observations.map((o, i) => `${x(i)},${y(o.condition_score)}`).join(" ");
  const bands = [
    { from: 100, to: CONFIG.status.healthy, c: STATUS_HEX.healthy },
    { from: CONFIG.status.healthy, to: CONFIG.status.attention, c: STATUS_HEX.attention },
    { from: CONFIG.status.attention, to: CONFIG.status.degraded, c: STATUS_HEX.degraded },
    { from: CONFIG.status.degraded, to: 0, c: STATUS_HEX.critical },
  ];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Condition score history">
      {bands.map((b) => (
        <rect key={b.from} x={pad.l} y={y(b.from)} width={W - pad.l - pad.r} height={y(b.to) - y(b.from)} fill={b.c} opacity={0.06} />
      ))}
      {[0, 40, 60, 80, 100].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={0.08} />
          <text x={pad.l - 4} y={y(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" opacity={0.5}>{v}</text>
        </g>
      ))}
      {observations.slice(1).map((o, i) => {
        const prev = observations[i]!;
        const drop = prev.condition_score - o.condition_score;
        return drop > CONFIG.significantDrop ? (
          <line key={o.id} x1={x(i)} y1={y(prev.condition_score)} x2={x(i + 1)} y2={y(o.condition_score)} stroke={STATUS_HEX.critical} strokeWidth={3} />
        ) : null;
      })}
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.85} />
      {observations.map((o, i) => (
        <g key={o.id}>
          <circle cx={x(i)} cy={y(o.condition_score)} r={3.5} fill={STATUS_HEX[statusFor(o.condition_score, false)]} />
          <text x={x(i)} y={y(o.condition_score) - 7} textAnchor="middle" fontSize="9" fill="currentColor">{o.condition_score}</text>
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.55}>
            {new Date(o.observed_at + "T00:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
          </text>
        </g>
      ))}
    </svg>
  );
}
