#!/usr/bin/env node
// Light polish over the bulk auto-enriched cards: strip "blog/home" cruft from
// names, and replace junky nav-text summaries with a clean fallback.
//   node scripts/cleanup_bulk.mjs /tmp/agg_live.txt

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ENR = join(ROOT, "data", "enrichment.json");
const slug = (host) => host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const ids = new Set(
  readFileSync(process.argv[2], "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
    .map((u) => { try { return slug(new URL(u.includes("://") ? u : "https://" + u).hostname); } catch { return null; } }).filter(Boolean)
);

const JUNK = /toggle navigation|skip to (main|content)|-->|enable javascript|javascript is (dis|not|required)|^\s*menu\b|◀|▶|loading\.\.\.|please wait|^\s*search\s*$/i;

const enr = JSON.parse(readFileSync(ENR, "utf8"));
let nameFix = 0, sumFix = 0;
for (const id of ids) {
  const e = enr[id];
  if (!e) continue;
  // name: strip trailing blog/home/website cruft
  const before = e.name;
  let n = e.name
    .replace(/[\s|·:–-]*\b(blog|weblog|home|homepage|personal (web ?)?site|website|official site)\b\.?$/i, "")
    .replace(/['’]s (blog|weblog|website|site|home|corner|page).*$/i, "")
    .trim();
  if (n && n.length >= 2) e.name = n;
  if (e.name !== before) nameFix++;
  // summary: replace nav-junk or name-echo
  const s = (e.summary || "").trim();
  const echo = s.toLowerCase().startsWith(e.name.toLowerCase()) && s.length < e.name.length + 4;
  if (JUNK.test(s) || echo || s.length < 8) { e.summary = `Personal site of ${e.name}.`; sumFix++; }
}
writeFileSync(ENR, JSON.stringify(enr, null, 2) + "\n");
console.log(`cleaned ${nameFix} names, ${sumFix} summaries`);
