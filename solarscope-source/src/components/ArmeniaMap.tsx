import type { FeatureCollection, Point } from "geojson";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, GeoJSONSource } from "maplibre-gl";
import provinces from "@/lib/armenia-provinces.json";
import { STATUS_HEX, STATUS_LABEL, type Station } from "@/lib/monitoring";

const ARMENIA_BOUNDS: [number, number, number, number] = [43.35, 38.8, 46.7, 41.35];

const STYLE = {
  version: 8 as const,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    dark: { type: "raster" as const, tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, maxzoom: 16, attribution: "Basemap © Esri" },
    sat: { type: "raster" as const, tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"], tileSize: 256, attribution: "Imagery © Esri" },
  },
  layers: [
    { id: "dark", type: "raster" as const, source: "dark" },
    { id: "sat", type: "raster" as const, source: "sat", layout: { visibility: "none" as const } },
  ],
};

// worst status first so clusters can show the worst inside
const RANK: Record<string, number> = { critical: 4, degraded: 3, attention: 2, unknown: 1, healthy: 0 };

function toGeo(list: Station[]) {
  return {
    type: "FeatureCollection" as const,
    features: list.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        status: s.status,
        rank: RANK[s.status],
        cond: s.condition == null || s.stale ? "?" : String(s.condition),
        color: STATUS_HEX[s.status],
        critical: s.status === "critical" ? 1 : 0,
        mw: Number(s.capacity_mw ?? 1),
        problems: s.problems.length,
      },
    })),
  };
}

export function ArmeniaMap({
  stations,
  selectedId,
  onSelect,
  focus,
  province,
  onProvince,
  picking,
  onMapClick,
}: {
  stations: Station[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  focus: { id: string; n: number } | null;
  province: string | null;
  onProvince: (name: string | null) => void;
  picking?: boolean | undefined;
  onMapClick?: ((lng: number, lat: number) => void) | undefined;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [basemap, setBasemap] = useState<"dark" | "sat">("dark");
  const cb = useRef({ onSelect, onProvince, onMapClick });
  cb.current = { onSelect, onProvince, onMapClick };
  const dataRef = useRef(stations);
  dataRef.current = stations;

  useEffect(() => {
    let cancelled = false;
    import("maplibre-gl")
      .then((ml) => {
        if (cancelled || !el.current) return;
        const m = new ml.Map({ container: el.current, style: STYLE, bounds: ARMENIA_BOUNDS, fitBoundsOptions: { padding: 30 }, attributionControl: { compact: true }, maxBounds: [40.5, 37.5, 49.5, 42.6] });
        map.current = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
        const ro = new ResizeObserver(() => m.resize());
        ro.observe(el.current);
        m.on("remove", () => ro.disconnect());
        m.on("load", () => {
          m.addSource("prov", { type: "geojson", data: provinces as FeatureCollection });
          m.addLayer({ id: "prov-fill", type: "fill", source: "prov", paint: { "fill-color": "#f5a524", "fill-opacity": ["case", ["==", ["get", "name"], ""], 0.08, 0.015] } });
          m.addLayer({ id: "prov-line", type: "line", source: "prov", paint: { "line-color": "#8fa3b8", "line-width": 0.8, "line-opacity": 0.55 } });
          m.addLayer({ id: "prov-label", type: "symbol", source: "prov", layout: { "text-field": ["upcase", ["get", "name"]], "text-font": ["Open Sans Semibold"], "text-size": 10, "text-letter-spacing": 0.15 }, paint: { "text-color": "#8fa3b8", "text-opacity": 0.7 } });

          m.addSource("st", {
            type: "geojson",
            data: toGeo(dataRef.current),
            cluster: true,
            clusterRadius: 30,
            clusterMaxZoom: 8,
            clusterProperties: { worst: ["max", ["get", "rank"]], crit: ["+", ["get", "critical"]] },
          });
          m.addLayer({
            id: "clusters", type: "circle", source: "st", filter: ["has", "point_count"],
            paint: {
              "circle-color": "#151b23",
              "circle-stroke-width": 3,
              "circle-stroke-color": ["match", ["get", "worst"], 4, STATUS_HEX.critical, 3, STATUS_HEX.degraded, 2, STATUS_HEX.attention, 1, STATUS_HEX.unknown, STATUS_HEX.healthy],
              "circle-radius": ["step", ["get", "point_count"], 14, 6, 18, 15, 22],
            },
          });
          m.addLayer({ id: "cluster-count", type: "symbol", source: "st", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Open Sans Semibold"], "text-size": 12 }, paint: { "text-color": "#e8edf3" } });
          m.addLayer({
            id: "crit-halo", type: "circle", source: "st", filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "critical"], 1]],
            paint: { "circle-radius": 20, "circle-color": STATUS_HEX.critical, "circle-opacity": 0.18, "circle-stroke-color": STATUS_HEX.critical, "circle-stroke-width": 1, "circle-stroke-opacity": 0.6 },
          });
          m.addLayer({ id: "sel", type: "circle", source: "st", filter: ["==", ["get", "id"], ""], paint: { "circle-radius": 18, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });
          m.addLayer({
            id: "pts", type: "circle", source: "st", filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["get", "mw"], 0, 8, 10, 10, 60, 13, 200, 15],
              "circle-color": ["get", "color"],
              "circle-stroke-color": "#0d1117",
              "circle-stroke-width": 1.5,
            },
          });
          m.addLayer({ id: "pt-label", type: "symbol", source: "st", filter: ["!", ["has", "point_count"]], layout: { "text-field": ["get", "cond"], "text-font": ["Open Sans Semibold"], "text-size": 9, "text-allow-overlap": true }, paint: { "text-color": "#0d1117" } });

          m.on("click", "clusters", async (e) => {
            const f = e.features?.[0];
            if (!f) return;
            const z = await (m.getSource("st") as GeoJSONSource).getClusterExpansionZoom(f.properties!["cluster_id"]);
            m.easeTo({ center: (f.geometry as Point).coordinates as [number, number], zoom: z + 0.5 });
          });
          m.on("click", (e) => {
            const pad = 8;
            const box: [[number, number], [number, number]] = [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
            if (m.queryRenderedFeatures(box, { layers: ["clusters"] }).length) return;
            const hit = m.queryRenderedFeatures(box, { layers: ["pts"] })[0];
            if (hit) {
              cb.current.onSelect(String(hit.properties["id"]));
              return;
            }
            if (cb.current.onMapClick) {
              cb.current.onMapClick(e.lngLat.lng, e.lngLat.lat);
              return;
            }
            const pv = m.queryRenderedFeatures(e.point, { layers: ["prov-fill"] })[0];
            if (pv && e.originalEvent.shiftKey) cb.current.onProvince(String(pv.properties["name"]));
          });
          const popup = new ml.Popup({ closeButton: false, closeOnClick: false, offset: 14 });
          m.on("mousemove", "pts", (e) => {
            const p = e.features?.[0]?.properties;
            if (!p) return;
            popup
              .setLngLat(e.lngLat)
              .setHTML(
                `<div style="font-weight:600;font-size:12px">${p["name"]}</div>` +
                  `<div style="font-size:11px;opacity:.65">${p["id"]}</div>` +
                  `<div style="font-size:11px;margin-top:3px"><b style="color:${p["color"]}">${STATUS_LABEL[p["status"] as keyof typeof STATUS_LABEL].toUpperCase()}</b> · Condition ${p["cond"]}/100 · ${p["problems"]} problem(s)</div>`,
              )
              .addTo(m);
          });
          m.on("mouseleave", "pts", () => popup.remove());
          for (const l of ["clusters", "pts"]) {
            m.on("mouseenter", l, () => (m.getCanvas().style.cursor = "pointer"));
            m.on("mouseleave", l, () => (m.getCanvas().style.cursor = ""));
          }
          setReady(true);
        });
      })
      .catch(() => setError(true));
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("st") as GeoJSONSource).setData(toGeo(stations));
  }, [stations, ready]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setPaintProperty("prov-fill", "fill-opacity", ["case", ["==", ["get", "name"], province ?? "__"], 0.1, 0.015]);
    m.setPaintProperty("prov-line", "line-color", ["case", ["==", ["get", "name"], province ?? "__"], "#f5a524", "#8fa3b8"]);
    if (province) {
      const f = (provinces as FeatureCollection).features.find((x: { properties?: Record<string, unknown> | null }) => x.properties?.["name"] === province);
      if (f) {
        const coords: number[][] = JSON.stringify(f.geometry).match(/-?\d+\.?\d*,-?\d+\.?\d*/g)!.map((s) => s.split(",").map(Number));
        const lngs = coords.map((c) => c[0]!), lats = coords.map((c) => c[1]!);
        m.fitBounds([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)], { padding: 60, duration: 900 });
      }
    }
  }, [province, ready]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setFilter("sel", ["all", ["!", ["has", "point_count"]], ["==", ["get", "id"], selectedId ?? ""]]);
  }, [selectedId, ready]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !focus) return;
    const s = dataRef.current.find((x) => x.id === focus.id);
    if (s) m.flyTo({ center: [s.lng, s.lat], zoom: Math.max(m.getZoom(), 10.5), duration: 1200 });
  }, [focus, ready]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setLayoutProperty("sat", "visibility", basemap === "sat" ? "visible" : "none");
    m.setLayoutProperty("dark", "visibility", basemap === "dark" ? "visible" : "none");
  }, [basemap, ready]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.getCanvas().style.cursor = picking ? "crosshair" : "";
  }, [picking, ready]);

  const resetView = () => map.current?.fitBounds(ARMENIA_BOUNDS, { padding: 30, duration: 800 });

  return (
    <div className="absolute inset-0 bg-base">
      <div ref={el} style={{ position: "absolute", inset: 0 }} />
      {picking && (
        <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2 border border-solar/60 bg-surface/95 px-3 py-1.5 text-[12px] text-solar">
          Click on the map to place the new station
        </div>
      )}
      {!ready && !error && <div className="absolute inset-0 grid place-items-center text-dim">Loading Armenia map…</div>}
      {error && <div className="absolute inset-0 grid place-items-center text-critical">Map failed to load. Check your connection and refresh.</div>}
      <div className="absolute top-2 right-2 flex gap-px border border-line bg-surface/95">
        {(["dark", "sat"] as const).map((b) => (
          <button key={b} onClick={() => setBasemap(b)} className={`px-2.5 py-1 text-[11px] ${basemap === b ? "bg-raised text-ink" : "text-dim hover:text-ink"}`}>
            {b === "dark" ? "Map" : "Satellite"}
          </button>
        ))}
        <button onClick={resetView} className="border-l border-line px-2.5 py-1 text-[11px] text-dim hover:text-ink">Reset view</button>
      </div>
      <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-3 border border-line bg-surface/95 px-2.5 py-1.5 text-[11px]">
        {(["healthy", "attention", "degraded", "critical", "unknown"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: STATUS_HEX[s] }} />
            {STATUS_LABEL[s]}
          </span>
        ))}
        <span className="text-dim">· number = condition score · size = capacity</span>
      </div>
    </div>
  );
}
