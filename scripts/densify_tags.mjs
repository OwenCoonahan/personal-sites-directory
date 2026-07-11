#!/usr/bin/env node
// Re-derive role + tags for bulk-imported sites with a much broader keyword set,
// using the page text already stored in sites.raw.json (no re-scraping). Only
// touches role/tags of the target ids; leaves name/summary/features intact.
//   node scripts/densify_tags.mjs /tmp/agg_live.txt

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const RAW = join(ROOT, "data", "sites.raw.json");
const ENR = join(ROOT, "data", "enrichment.json");
const slug = (h) => h.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
const targetIds = new Set(
  readFileSync(process.argv[2], "utf8").split("\n").map((s) => s.trim()).filter(Boolean)
    .map((u) => { try { return slug(new URL(u.includes("://") ? u : "https://" + u).hostname); } catch { return null; } }).filter(Boolean)
);

// role: first match wins
const ROLE_RULES = [
  ["Founder", /\b(founder|co-?founder|ceo\b|cto\b|coo\b|entrepreneur|indie ?hacker|solopreneur|i (co-?)?founded|i run (a|my)|building (a|my) (company|startup|product)|my (company|startup))\b/],
  ["Investor", /\b(investor|venture (capital|partner)|\bvc\b|general partner|angel investor|managing partner|i invest|partner at|capital\b)\b/],
  ["Researcher", /\b(researcher|research (scientist|engineer|fellow)|ph\.?\s?d|professor|postdoc|scientist|faculty|academic|dphil|my research|publications|google scholar|laboratory|university|studying .* (at|phd))\b/],
  ["Designer", /\b(designer|design engineer|\bux\b|\bui\b|product design|art director|graphic design|brand design|visual design|i design|type ?face)\b/],
  ["Artist", /\b(artist|illustrat|painter|animator|musician|composer|3d artist|creative technologist|comic|cartoonist)\b/],
  ["Photographer", /\b(photographer|photography)\b/],
  ["Writer", /\b(writer|author|essayist|journalist|novelist|columnist|i write about|my (essays|writing|newsletter)|poet)\b/],
  ["Developer", /\b(developer|engineer|programmer|software|full[- ]?stack|frontend|front-end|back[- ]?end|hacker|coder|i (code|build software)|\bswe\b|web dev|devops|sysadmin)\b/],
  ["Maker", /\b(maker|builder|tinkerer|i (make|build) (things|stuff)|i love (making|building)|hobbyist)\b/],
  ["Student", /\b(student|undergrad|grad(uate)? student|cs student|studying (cs|computer|at))\b/],
];
// fallback: dev-favored static-site generators strongly imply a developer
const DEV_TECH = /^(Jekyll|Hugo|Gatsby|Next\.js|Astro|Svelte|Nuxt)$/;

// tags: collect (cap 4), priority order; values stay within the existing vocab
const TAG_RULES = [
  ["AI", /\b(machine learning|deep learning|\bml\b|\bai\b|artificial intelligence|neural network|\bnlp\b|\bllm\b|large language|data science|reinforcement learning|computer vision|transformer|generative (ai|model)|pytorch|tensorflow|diffusion model)\b/],
  ["Web Dev", /\b(web dev|frontend|front-end|javascript|typescript|\breact\b|\bvue\b|svelte|\bcss\b|full[- ]?stack|\bnode\b|tailwind|next\.?js|web development|rails|django|laravel)\b/],
  ["Design", /\b(design(er|s)?|typography|branding|\bux\b|\bui\b|visual)\b/],
  ["Startups", /\b(startup|saas|indie hack|bootstrapp|founder|entrepreneur|venture|micro-?saas)\b/],
  ["Writing", /\b(essays?|newsletter|writing|\bauthor\b|blog about|poetry|prose|substack)\b/],
  ["Open Source", /\b(open[- ]source|\boss\b|maintainer|contributor|github\.com|npm package)\b/],
  ["Crypto", /\b(crypto|blockchain|web3|ethereum|bitcoin|defi|\bnft\b|smart contract)\b/],
  ["Security", /\b(security|infosec|cyber ?security|pentest|cryptography|privacy|vulnerabilit)\b/],
  ["Hardware", /\b(hardware|electronics|embedded|robotics|\biot\b|microcontroller|fpga|\bchip design|semiconductor)\b/],
  ["Math", /\b(mathematic|statistics|probability|calculus|geometry|number theory|\bmath\b)\b/],
  ["Health", /\b(medicine|neuroscience|biolog|genomic|healthcare|\bhealth\b|fitness|wellness|psychology)\b/],
  ["Finance", /\b(finance|investing|economics|quant|trading|markets|fintech)\b/],
  ["Product", /\b(product manage|product design|\bpm\b|product management)\b/],
  ["Photography", /\b(photograph|photo essay)\b/],
  ["Art", /\b(illustration|drawing|painting|generative art|comics|animation|\bart\b)\b/],
  ["Music", /\b(music|musician|producer|synth|audio engineer)\b/],
  ["Education", /\b(teacher|educat|tutorial|course|lecture|teaching|explain)\b/],
  ["Politics", /\b(politics|policy|government|election|geopolitic)\b/],
];

const raw = JSON.parse(readFileSync(RAW, "utf8"));
const rawById = new Map(raw.map((r) => [r.id, r]));
const enr = JSON.parse(readFileSync(ENR, "utf8"));

let gotRole = 0, gotTags = 0, total = 0;
for (const id of targetIds) {
  const e = enr[id]; const r = rawById.get(id);
  if (!e || !r) continue;
  total++;
  const hay = `${r.title} ${r.description} ${(r.textSnippet || "").slice(0, 800)}`.toLowerCase();
  let role = "";
  for (const [ro, re] of ROLE_RULES) if (re.test(hay)) { role = ro; break; }
  if (!role && (r.tech || []).some((t) => DEV_TECH.test(t))) role = "Developer";
  const tags = [];
  for (const [tag, re] of TAG_RULES) { if (tags.length >= 4) break; if (re.test(hay)) tags.push(tag); }
  if (role) gotRole++;
  if (tags.length) gotTags++;
  e.role = role;
  e.tags = tags;
}
writeFileSync(ENR, JSON.stringify(enr, null, 2) + "\n");
console.log(`densified ${total} bulk sites | now have role: ${gotRole} (${Math.round(gotRole / total * 100)}%) | have tags: ${gotTags} (${Math.round(gotTags / total * 100)}%)`);
