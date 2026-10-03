import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { datasetQuery, kpis } from "@/lib/monitoring";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/", label: "Map" },
  { to: "/stations", label: "Stations" },
  { to: "/alerts", label: "Alerts" },
  { to: "/analytics", label: "Analytics" },
  { to: "/admin", label: "Admin" },
] as const;

export function AppHeader() {
  const { data } = useQuery(datasetQuery);
  const k = data ? kpis(data.stations) : null;
  const { user } = useAuth();
  return (
    <header className="flex h-11 shrink-0 items-center gap-6 border-b border-line bg-base px-4">
      <Link to="/" className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-sm bg-solar text-[13px] font-bold text-base">◐</span>
        <span className="font-display text-[16px] font-bold tracking-[0.08em]">
          SOLARSCOPE <span className="text-solar">ARMENIA</span>
        </span>
      </Link>
      <nav className="flex h-full items-stretch overflow-x-auto">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            activeOptions={{ exact: n.to === "/", includeSearch: false }}
            className="flex items-center gap-1.5 border-b-2 border-transparent px-3 font-display text-[13px] font-semibold tracking-[0.12em] text-dim uppercase hover:text-ink"
            activeProps={{ className: "!border-solar !text-ink" }}
          >
            {n.label}
            {n.to === "/alerts" && k && k.criticalAlerts > 0 && (
              <span className="flex items-center gap-1 rounded-sm bg-critical/15 px-1.5 font-mono text-[11px] text-critical">
                <span className="size-1.5 animate-pulse-ring rounded-full bg-critical" />
                {k.criticalAlerts}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden rounded-sm bg-solar/10 px-2 py-0.5 text-[10px] font-medium tracking-wider text-solar uppercase ring-1 ring-solar/30 md:inline">
          Demo Monitoring Data
        </span>
        {user ? (
          <span className="hidden max-w-[160px] truncate text-[11px] text-dim sm:inline">{user.email}</span>
        ) : (
          <Link to="/auth" className="text-[11px] text-dim hover:text-ink">Sign in</Link>
        )}
      </div>
    </header>
  );
}
