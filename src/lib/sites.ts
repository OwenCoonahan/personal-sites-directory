import seed from "../../data/sites.json";
import type { Site } from "./types";

const SEED = seed as Site[];

export const SITE_URL = "https://homepages.owencoonahan.xyz";

// Recompute graph edges + in-degree over whatever set we're showing
// (seed + approved community sites), so links stay correct as it grows.
function computeGraph(sites: Site[]): Site[] {
  const hostToId = new Map<string, string>();
  for (const s of sites) hostToId.set(s.host.replace(/^www\./, ""), s.id);
  const enriched = sites.map((s) => ({ ...s, links: [] as string[], inDegree: 0 }));
  const byId = new Map(enriched.map((s) => [s.id, s]));
  for (const s of enriched) {
    s.links = [
      ...new Set(
        (s.outbound || [])
          .map((h) => hostToId.get(h.replace(/^www\./, "")))
          .filter((id): id is string => !!id && id !== s.id)
      ),
    ];
  }
  for (const s of enriched) for (const t of s.links) byId.get(t) && byId.get(t)!.inDegree++;
  return enriched;
}

let _all: Site[] | null = null;
export function getSites(): Site[] {
  if (!_all) _all = computeGraph(SEED).sort((a, b) => b.inDegree - a.inDegree || a.name.localeCompare(b.name));
  return _all;
}

let _byId: Map<string, Site> | null = null;
export function getSiteById(id: string): Site | undefined {
  if (!_byId) _byId = new Map(getSites().map((s) => [s.id, s]));
  return _byId.get(id);
}

// Related sites for a detail page: what it links to + who links to it (deduped).
export function relatedSites(site: Site): Site[] {
  const all = getSites();
  const byId = new Map(all.map((s) => [s.id, s]));
  const out = site.links.map((id) => byId.get(id)).filter((s): s is Site => !!s);
  const inbound = all.filter((s) => s.links.includes(site.id));
  const seen = new Set<string>();
  return [...out, ...inbound].filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

export function seedHosts(): Set<string> {
  return new Set(SEED.map((s) => s.host.replace(/^www\./, "")));
}

export function facets(sites: Site[]) {
  const count = (key: "role" | "tags" | "features") => {
    const m = new Map<string, number>();
    for (const s of sites) {
      const vals = key === "role" ? [s.role] : s[key];
      for (const v of vals) if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([value, n]) => ({ value, n }));
  };
  return { roles: count("role"), tags: count("tags"), features: count("features") };
}
