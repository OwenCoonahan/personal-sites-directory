import seed from "../../data/sites.json";
import type { Site } from "./types";
import { listApproved } from "./store";

const SEED = seed as Site[];

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

export async function getSites(): Promise<Site[]> {
  const approved = await listApproved();
  const seen = new Set(SEED.map((s) => s.id));
  const merged = [...SEED, ...approved.filter((a) => !seen.has(a.id))];
  return computeGraph(merged).sort((a, b) => b.inDegree - a.inDegree || a.name.localeCompare(b.name));
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
