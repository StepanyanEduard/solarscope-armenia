import type { ReactNode } from "react";
import { SEVERITY_HEX, STATUS_HEX, STATUS_LABEL, VERIFICATION_LABEL, type Status } from "@/lib/monitoring";

export function StatusBadge({ status, big }: { status: Status; big?: boolean }) {
  const c = STATUS_HEX[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm font-display font-semibold tracking-[0.1em] uppercase ${big ? "px-2 py-1 text-[13px]" : "px-1.5 py-0.5 text-[11px]"}`}
      style={{ color: c, backgroundColor: `${c}1f`, boxShadow: `inset 0 0 0 1px ${c}55` }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: c }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SeverityTag({ severity }: { severity: string }) {
  const c = SEVERITY_HEX[severity] ?? "#7d8896";
  return (
    <span className="rounded-sm px-1.5 py-0.5 font-display text-[11px] font-semibold tracking-[0.1em] uppercase" style={{ color: c, backgroundColor: `${c}1a` }}>
      {severity}
    </span>
  );
}

export function VerificationTag({ v }: { v: string }) {
  return <span className="rounded-sm bg-raised px-1.5 py-0.5 text-[10px] text-dim ring-1 ring-line">{VERIFICATION_LABEL[v] ?? v}</span>;
}

export function DemoTag({ children = "Demo Monitoring Data" }: { children?: ReactNode }) {
  return <span className="rounded-sm bg-solar/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-solar uppercase ring-1 ring-solar/30">{children}</span>;
}

export function Panel({ title, right, children, className = "" }: { title?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`border border-line bg-surface ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-3 py-2">
          <h2 className="label-caps">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line/50 py-1.5 last:border-0">
      <span className="text-dim">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

export function ConditionValue({ value, status }: { value: number | null; status: Status }) {
  return (
    <span className="font-mono font-semibold" style={{ color: STATUS_HEX[status] }}>
      {value == null ? "—" : value}
      <span className="text-dim font-normal">/100</span>
    </span>
  );
}
