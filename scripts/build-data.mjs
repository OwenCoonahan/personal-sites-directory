#!/usr/bin/env node
// Merge the deterministic scrape (sites.raw.json) with the hand/LLM enrichment
// layer (enrichment.json) into the final data/sites.json the app reads.
// Also resolves graph edges (which directory sites link to each other) and the
// in-degree ranking signal.
//
//   node scripts/build-data.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW = join(ROOT, "data", "sites.raw.json");
const ENRICH = join(ROOT, "data", "enrichment.json");
const OUT = join(ROOT, "data", "sites.json");

const raw = JSON.parse(readFileSync(RAW, "utf8"));
const enrich = existsSync(ENRICH) ? JSON.parse(readFileSync(ENRICH, "utf8")) : {};

function titleCaseHost(host) {
  return host.replace(/^www\./, "");
}

function defaultName(r) {
  // Use page title up to a separator, else the host.
  const t = (r.title || "").split(/[|–—\-·:]/)[0].trim();
  if (t && t.length <= 40 && !/^https?:/i.test(t)) return t;
  return titleCaseHost(r.host);
}

function defaultFeatures(r) {
  const f = [];
  if (r.feeds && r.feeds.length) f.push("Blog");
  return f;
}

const hostToId = new Map();
for (const r of raw) hostToId.set(r.host.replace(/^www\./, ""), r.id);

const sites = raw.map((r) => {
  const e = enrich[r.id] || {};
  const links = [
    ...new Set((r.outbound || []).map((h) => hostToId.get(h.replace(/^www\./, ""))).filter((id) => id && id !== r.id)),
  ];
  return {
    id: r.id,
    url: r.url,
    host: r.host,
    finalUrl: r.finalUrl || r.url,
    name: e.name || defaultName(r),
    title: r.title || "",
    summary: e.summary || r.description || "",
    description: r.description || "",
    screenshot: r.screenshot || null,
    ogImage: r.ogImage || null,
    favicon: r.favicon || null,
    role: e.role || "",
    tags: e.tags || [],
    features: e.features || defaultFeatures(r),
    tech: r.tech || [],
    feeds: r.feeds || [],
    outbound: r.outbound || [],
    links,
    inDegree: 0,
    status: r.status || "ok",
  };
});

// in-degree: how many directory sites link to each
const byId = new Map(sites.map((s) => [s.id, s]));
for (const s of sites) for (const target of s.links) if (byId.has(target)) byId.get(target).inDegree++;

writeFileSync(OUT, JSON.stringify(sites, null, 2));

const enriched = sites.filter((s) => enrich[s.id]).length;
const edges = sites.reduce((n, s) => n + s.links.length, 0);
console.log(`Built ${sites.length} sites → ${OUT}`);
console.log(`  enriched: ${enriched}/${sites.length}`);
console.log(`  graph edges: ${edges}`);
console.log(`  most-linked: ${[...sites].sort((a, b) => b.inDegree - a.inDegree).slice(0, 5).map((s) => `${s.name}(${s.inDegree})`).join(", ")}`);
