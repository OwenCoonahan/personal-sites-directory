# Changelog — Homepages

## 2026-06-29 — live on Vercel + simplified (Dev)

Shipped it and stripped the over-built bits.

- **Live**: own GitHub repo (`OwenCoonahan/personal-sites-directory`, public) + Vercel deploy (`homepages-iota.vercel.app`). Pushes to `main` auto-deploy.
- **Submit flow simplified**: deleted the whole submission backend — `/api/submit`, `/api/admin`, `/admin`, `store.ts` (Upstash queue + rate limit), `profile-lite.ts`, Turnstile. "Suggest a site" is now a plain inline form that POSTs to **Formspree** (set `NEXT_PUBLIC_FORMSPREE_ID`), or falls back to a pre-filled email if unset. Approved-queue merge removed from `sites.ts`; home page is no longer `force-dynamic` — the whole app is now a single static page.
- **Header / filters redesigned**: the filter wall (7 roles + features + ~28 tags + sort) used to eat the entire first screen on mobile. Now one compact row — search · **Filters** (collapsible, closed by default, with active count) · **Sort** dropdown. Active filters show as removable chips. Cards are visible immediately on mobile.
- **Detail modal**: the `esc` text close affordance is now a clear round **✕** button.

## 2026-06-23 — v0.2 submit flow + moderation queue (Dev) — SUPERSEDED 2026-06-29

Made "Add your site" real, with spam protection built around an approval queue.

- **Submit modal** (`SubmitModal.tsx`): URL + optional name/note, honeypot field, optional Cloudflare Turnstile widget. Wired to the header button.
- **`POST /api/submit`**: honeypot drop → Turnstile verify (skipped if unconfigured) → per-IP rate limit (3/day) → URL normalize/validate → dedupe vs seed + approved + pending → reachability check (must return HTML) → enqueue as pending. All branches tested via curl (valid / dupe / honeypot / garbage / rate-limit-429).
- **Admin** (`/admin` + `/api/admin`): password-gated (ADMIN_PASSWORD) review queue. Approve runs the serverless lite-profiler (`profile-lite.ts`: metadata + mShots screenshot, no headless browser) and publishes; reject drops it. Tested end-to-end: submit → approve → site appears on home → queue empties.
- **Storage** (`store.ts`): Upstash Redis via REST (queue + rate limit) in prod, local JSON-file fallback in dev. No new npm deps.
- **Reads** (`sites.ts`): home now merges seed `sites.json` + approved community sites and recomputes the graph over the union. Page is `force-dynamic` so approvals show immediately. Dropped static export (needed for API routes).
- Env documented in `.env.example`. Local queue + `.env.local` gitignored.

### To go live on Vercel (needs your accounts — all free tier)
1. Create an Upstash Redis DB → set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.
2. Set `ADMIN_PASSWORD` to something real.
3. (Optional) Cloudflare Turnstile → set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET`.
4. Deploy. Without Upstash the queue won't persist (Vercel FS is read-only).

## 2026-06-23 — v0.1 scaffold + first 83 sites live (Dev)

Built the directory of personal websites end to end.

- **Scaffold**: Next.js 16 (App Router, TS, Tailwind v4) in `Scheming/homepages`. Turbopack `root` pinned per the workspace machine-freeze rule. Static export (`output: "export"`) since v1 has no backend yet — serves without a `next-server` (watchdog allows only one) and deploys to Vercel as plain static.
- **Profile pipeline** (`scripts/profile.mjs`): for each seed URL, fetch metadata (title, description, og:image, favicon, RSS feeds, detected tech, outbound links, text snippet) and capture a 1280×800 screenshot via the Playwright chromium already cached in `Grand Library/node_modules` (no new install). 83 sites, 82 screenshots (only vednig.site failed — fetch error).
- **Enrichment layer** (`data/enrichment.json`): hand-authored name / one-line summary / role / tags / features for all 83 sites (no Anthropic key in env, so authored directly; an API-backed version is the next step for user submissions).
- **Merge + graph** (`scripts/build-data.mjs`): combines raw scrape + enrichment into `data/sites.json`, resolves inter-site links (graph edges) and `inDegree` ranking. Only 7 edges at this scale — confirms grid-first, graph-later.
- **UI**: grid of screenshot cards (name, role, one-liner, tags), sticky filter bar (search + role pills + feature/topic filters + Featured/A–Z/Shuffle sort), click-to-expand detail modal (full context + tech + feeds + graph connections + visit). Clean-minimal design system.

Live locally during build via static server on `:4321`.

### Known limitations
- Cloudflare/Vercel-protected sites (stratechery, paulstamatiou, lukewin) screenshot as their interstitial. Fix: detect interstitials and fall back to og:image, or re-shoot with a real browser session.
- "Add your site" is a `mailto:` placeholder — real submit flow needs a backend (see TODO).
- Product name "Homepages" is a working title.
