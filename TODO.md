# TODO — Homepages

Live: https://homepages-iota.vercel.app · repo: OwenCoonahan/personal-sites-directory (pushes to `main` auto-deploy).

## Now
- [x] Deploy to Vercel + own GitHub repo
- [x] Simplify submit → Formspree inline form (no backend/queue/admin)
- [x] Collapse the filter wall into a Filters dropdown (mobile fix) + Sort dropdown + ✕ close button
- [ ] Create a Formspree form and set `NEXT_PUBLIC_FORMSPREE_ID` on Vercel (until then the form opens a pre-filled email)
- [ ] Custom domain (decide one, point DNS at Vercel)
- [ ] Interstitial fix: detect "Checking your browser" / Vercel checkpoint shots → fall back to og:image
- [ ] Dedupe same-person entries (jessyin.world + music.jessyin.world; arambartholl)

## Backlog
- [ ] Crawl outbound links deeper to find new candidate sites (organic discovery)
- [ ] "Most-linked" leaderboard as a shareable hook
- [ ] Import path for larger seed lists (e.g. personalsit.es) if/when wanted
- [ ] Graph view (Figma-style draggable canvas) — only worth it once there are enough edges (currently ~7)
