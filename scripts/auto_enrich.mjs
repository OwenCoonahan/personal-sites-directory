#!/usr/bin/env node
// Heuristic auto-enrichment for bulk-added sites. For every raw record whose id
// is in the given list AND has no enrichment yet: derive name/summary from
// title+description, and guess role/tags from keywords. Also prunes records
// that turn out to be bot-walls / parked / dead (removes raw + shot + seed).
//
//   node scripts/auto_enrich.mjs /tmp/agg_live.txt

import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW = join(ROOT, "data", "sites.raw.json");
const ENR = join(ROOT, "data", "enrichment.json");
const SEEDS = join(__dirname, "seed-urls.txt");
const SHOTS = join(ROOT, "public", "shots");
const LIST = process.argv[2];

const slug = (host) => host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const targetIds = new Set(
  readFileSync(LIST, "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
    .map((u) => { try { return slug(new URL(u.includes("://") ? u : "https://" + u).hostname); } catch { return null; } })
    .filter(Boolean)
);

const BAD_TITLE = /(security checkpoint|just a moment|checking your browser|attention required|are you human|access denied|forbidden|not found|error 4\d\d|error 5\d\d|502 bad|503 service|domain (name )?is for sale|buy this domain|parked|account suspended|this site can.t be reached)/i;

// role: first match wins (priority order)
const ROLE_RULES = [
  ["Founder", /\b(founder|co-?founder|ceo|cto|entrepreneur)\b/],
  ["Investor", /\b(investor|venture capital|\bvc\b|general partner|angel investor|managing partner)\b/],
  ["Researcher", /\b(researcher|research scientist|research engineer|ph\.?d|professor|postdoc|scientist|faculty|academic)\b/],
  ["Designer", /\b(designer|design engineer|\bux\b|\bui\b|product design|art director)\b/],
  ["Artist", /\b(artist|illustrat|painter|animator|musician|composer|3d artist)\b/],
  ["Writer", /\b(writer|author|essayist|journalist|novelist|columnist)\b/],
  ["Photographer", /\b(photographer|photography)\b/],
  ["Developer", /\b(developer|engineer|programmer|software|full[- ]?stack|frontend|front-end|back[- ]?end|hacker|coder)\b/],
  ["Student", /\b(student|undergrad|grad student)\b/],
];
// tags: collect matches, cap 3 (priority order)
const TAG_RULES = [
  ["AI", /\b(machine learning|deep learning|\bml\b|\bai\b|artificial intelligence|neural network|\bnlp\b|\bllm\b|data science|reinforcement learning|computer vision)\b/],
  ["Web Dev", /\b(web dev|frontend|front-end|javascript|typescript|react|vue|svelte|\bcss\b|full[- ]?stack)\b/],
  ["Design", /\bdesign\b/],
  ["Startups", /\b(startup|saas|indie hack|bootstrapp|founder)\b/],
  ["Writing", /\b(essays|newsletter|writing|blog about|author)\b/],
  ["Open Source", /\b(open[- ]source|\boss\b)\b/],
  ["Crypto", /\b(crypto|blockchain|web3|ethereum|bitcoin|defi)\b/],
  ["Security", /\b(security|infosec|cybersecurity|pentest)\b/],
  ["Product", /\bproduct manage|product design|\bpm\b\b/],
  ["Math", /\b(mathematic|statistics|probability)\b/],
  ["Photography", /\bphotograph/],
  ["Art", /\b(illustration|drawing|painting|generative art)\b/],
  ["Music", /\b(music|musician|producer)\b/],
  ["Education", /\b(teacher|educat|tutorial|course|lecture)\b/],
];

const GENERIC = /^(home|blog|welcome|homepage|index|personal (web)?site|about|untitled|new tab|my (blog|site|website))$/i;
function cleanName(rec) {
  let t = (rec.title || "").trim();
  // take the first segment before a separator
  const seg = t.split(/\s[|–—·:]\s|(?: - )/)[0].trim();
  let name = seg || t;
  name = name.replace(/'s (blog|website|site|home|corner).*$/i, "").replace(/^(home|welcome to)\b[\s|:–-]*/i, "").trim();
  if (!name || name.length > 44 || GENERIC.test(name) || /^https?:/i.test(name)) {
    // fall back to host without TLD, prettified
    const h = rec.host.replace(/^www\./, "").split(".")[0];
    name = h.charAt(0).toUpperCase() + h.slice(1);
  }
  return name;
}
function summaryOf(rec, name) {
  let d = (rec.description || "").replace(/\s+/g, " ").trim();
  if (d && d.length >= 12 && d.length <= 180 && !BAD_TITLE.test(d)) return d;
  const snip = (rec.textSnippet || "").replace(/\s+/g, " ").trim();
  const sentence = snip.split(/(?<=[.!?])\s/)[0];
  if (sentence && sentence.length >= 20 && sentence.length <= 160) return sentence;
  return `Personal site of ${name}.`;
}
function roleTags(rec) {
  const hay = `${rec.title} ${rec.description} ${(rec.textSnippet || "").slice(0, 600)}`.toLowerCase();
  let role = "";
  for (const [r, re] of ROLE_RULES) if (re.test(hay)) { role = r; break; }
  const tags = [];
  for (const [tag, re] of TAG_RULES) { if (tags.length >= 3) break; if (re.test(hay)) tags.push(tag); }
  return { role, tags };
}

let raw = JSON.parse(readFileSync(RAW, "utf8"));
const enr = existsSync(ENR) ? JSON.parse(readFileSync(ENR, "utf8")) : {};
const removed = [];
let enriched = 0;
const keep = [];
for (const rec of raw) {
  const isTarget = targetIds.has(rec.id) && !enr[rec.id];
  if (!isTarget) { keep.push(rec); continue; }
  // prune bad ones
  const bad = BAD_TITLE.test(rec.title || "") || (rec.status === "fetch_error" && !rec.screenshot && !(rec.description));
  if (bad) {
    removed.push(rec);
    if (rec.screenshot) { try { rmSync(join(ROOT, "public", rec.screenshot.replace(/^\//, "")), { force: true }); } catch {} }
    continue;
  }
  const name = cleanName(rec);
  const { role, tags } = roleTags(rec);
  enr[rec.id] = { name, summary: summaryOf(rec, name), role, tags, features: rec.feeds && rec.feeds.length ? ["Blog"] : [] };
  enriched++;
  keep.push(rec);
}
raw = keep;

// clean seed for removed
if (removed.length) {
  const removeHosts = new Set(removed.map((r) => r.host));
  const seed = readFileSync(SEEDS, "utf8").split("\n").filter((l) => { try { return !removeHosts.has(new URL(l.trim()).hostname); } catch { return true; } });
  writeFileSync(SEEDS, seed.join("\n"));
}
writeFileSync(RAW, JSON.stringify(raw, null, 2));
writeFileSync(ENR, JSON.stringify(enr, null, 2) + "\n");
console.log(`auto-enriched ${enriched} | pruned ${removed.length} bad (${removed.slice(0, 8).map((r) => r.host).join(", ")}${removed.length > 8 ? "…" : ""})`);
