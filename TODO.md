# TODO — Homepages

## Phase 1 — polish the v1 grid (done-ish)
- [x] Scaffold + scrape + screenshot 83 seed sites
- [x] Enrichment (name/summary/role/tags/features) for all sites
- [x] Grid + filters + search + sort + detail modal
- [ ] Interstitial fix: detect "Checking your browser" / Vercel checkpoint shots → fall back to og:image
- [ ] Dedupe same-person entries (jessyin.world + music.jessyin.world; arambartholl)
- [ ] Decide product name (working title: "Homepages")
- [ ] Deploy static build to Vercel

## Phase 2 — submissions + claim (the growth loop)
- [x] Submit flow: paste URL → validate/dedupe/rate-limit → approval queue
- [x] Light moderation: honeypot + Turnstile + per-IP rate limit + reachability; nothing public until approved
- [x] Admin review page (approve runs lite-profiler + publishes)
- [x] Storage: Upstash (prod) / file fallback (dev)
- [ ] Set up Upstash + Turnstile + ADMIN_PASSWORD and deploy to Vercel (see CHANGELOG v0.2)
- [ ] Auto-profile via Anthropic API on approval (role/tags/summary; needs ANTHROPIC_API_KEY) — currently community sites get blank role/tags until claimed
- [ ] Backfill nicer Playwright screenshots for approved sites (mShots is the interim shot)
- [ ] Claim-your-site → owner edits summary/tags/links (the enrich ceiling on top of the auto floor)

## Phase 3 — the graph view
- [ ] Figma-style draggable 2D canvas, sites as nodes, edges = real inter-site links
- [ ] Cluster/color by topic, size by inDegree (PageRank-lite for the personal web)
- [ ] Only worth rendering once there are enough edges (currently 7)

## Ideas / backlog
- [ ] Crawl outbound links deeper to find new candidate sites (organic discovery)
- [ ] "Most-linked" leaderboard as a shareable hook
- [ ] Import path for larger seed lists (e.g. personalsit.es) if/when wanted
