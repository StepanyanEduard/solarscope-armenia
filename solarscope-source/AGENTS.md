<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- All app data is read from the Cloud tables (stations, observations, problems, alerts, provinces, data_sources) by datasetQuery in src/lib/monitoring.ts; status, score explanation and priority are derived there so thresholds live in one CONFIG.
- maplibre-gl is loaded via dynamic import inside ArmeniaMap and excluded from Vite optimizeDeps, because SSR can't load it and pre-bundling breaks its worker.
- Public pages are readable anonymously (public-read RLS); admin writes go through the browser client and are enforced by has_role RLS policies.
