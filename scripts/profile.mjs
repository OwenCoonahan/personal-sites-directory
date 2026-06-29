#!/usr/bin/env node
// Profile pipeline for Homepages.
// For each seed URL: fetch HTML + headers (title, description, og:image, favicon,
// feeds, tech, outbound links, text snippet) and capture a screenshot via the
// Playwright chromium already cached in Grand Library/node_modules.
//
//   node scripts/profile.mjs                 # all seed URLs
//   node scripts/profile.mjs --limit 5       # first 5 (smoke test)
//   node scripts/profile.mjs --no-shots      # metadata only, skip screenshots
//
// Writes:  data/sites.raw.json  +  public/shots/<id>.webp
// Screenshots are best-effort; metadata still records if a shot fails.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHOTS_DIR = join(ROOT, "public", "shots");
const OUT = join(ROOT, "data", "sites.raw.json");
const PLAYWRIGHT = "/Users/owencoonahan/Documents/Grand Library/node_modules/playwright/index.mjs";

const args = process.argv.slice(2);
const LIMIT = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;
const NO_SHOTS = args.includes("--no-shots");
const CONCURRENCY = 4;
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Social / infra hosts that are not "personal sites" — excluded from outbound graph edges.
const NON_SITE_HOSTS =
  /(twitter|x|linkedin|github|instagram|facebook|youtube|youtu\.be|tiktok|medium|substack|notion|bsky|threads|mastodon|t\.co|goo\.gl|bit\.ly|google|gstatic|gravatar|cloudflare|vercel|netlify|cdn|fonts|gmail|mailto|calendly|stripe|paypal|patreon|buymeacoffee|spotify|apple|amazon|reddit|discord|telegram|whatsapp|figma|dribbble|behance|producthunt|hackernews|news\.ycombinator)/i;

function readSeeds() {
  return readFileSync(join(__dirname, "seed-urls.txt"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function slug(host) {
  return host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

// Normalize seeds → one record per host, preferring the root path.
function normalize(urls) {
  const byHost = new Map();
  for (const raw of urls) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }
    const host = u.hostname;
    const isRoot = u.pathname === "/" || u.pathname === "";
    const existing = byHost.get(host);
    // Prefer the root URL; otherwise keep the first seen.
    if (!existing || (isRoot && !existing.isRoot)) {
      byHost.set(host, { host, url: `${u.protocol}//${host}${isRoot ? "/" : u.pathname}`, isRoot });
    }
  }
  return [...byHost.values()].map((r) => ({ id: slug(r.host), host: r.host, url: r.url }));
}

// --- tiny HTML attribute parser (no deps) -----------------------------------
function tags(html, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  let m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
}
function attr(tag, key) {
  const m = tag.match(new RegExp(`\\b${key}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
}
function metaContent(html, keyVal) {
  for (const t of tags(html, "meta")) {
    const n = (attr(t, "name") || attr(t, "property") || "").toLowerCase();
    if (n === keyVal) return decode(attr(t, "content") || "");
  }
  return null;
}
function decode(s) {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").trim();
}
function abs(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function detectTech(html, headers) {
  const t = new Set();
  const h = html.toLowerCase();
  const gen = (metaContent(html, "generator") || "").toLowerCase();
  const powered = (headers.get("x-powered-by") || "").toLowerCase();
  const server = (headers.get("server") || "").toLowerCase();
  if (h.includes("__next_data__") || h.includes("/_next/") || gen.includes("next")) t.add("Next.js");
  if (h.includes("/_nuxt/") || gen.includes("nuxt")) t.add("Nuxt");
  if (gen.includes("gatsby")) t.add("Gatsby");
  if (gen.includes("hugo")) t.add("Hugo");
  if (gen.includes("jekyll")) t.add("Jekyll");
  if (gen.includes("astro") || h.includes("astro-")) t.add("Astro");
  if (gen.includes("wordpress") || h.includes("wp-content")) t.add("WordPress");
  if (gen.includes("ghost")) t.add("Ghost");
  if (gen.includes("svelte") || h.includes("svelte")) t.add("Svelte");
  if (h.includes("data-reactroot") || h.includes("react")) t.add("React");
  if (h.includes("three.js") || h.includes("three.module") || h.includes("r3f") || h.includes("webgl")) t.add("WebGL/Three.js");
  if (server.includes("vercel") || (headers.get("x-vercel-id"))) t.add("Vercel");
  if (powered.includes("framer") || h.includes("framerusercontent")) t.add("Framer");
  if (h.includes("squarespace")) t.add("Squarespace");
  if (h.includes("cdn.shopify")) t.add("Shopify");
  return [...t];
}

async function fetchMeta(site) {
  const res = await fetch(site.url, {
    headers: { "user-agent": UA, accept: "text/html,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const finalUrl = res.url || site.url;
  const html = await res.text();

  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " "));
  const description =
    metaContent(html, "description") || metaContent(html, "og:description") || metaContent(html, "twitter:description") || "";
  const ogImage = metaContent(html, "og:image") || metaContent(html, "twitter:image") || null;

  // favicon
  let favicon = null;
  for (const t of tags(html, "link")) {
    const rel = (attr(t, "rel") || "").toLowerCase();
    if (rel.includes("icon")) {
      favicon = abs(finalUrl, attr(t, "href"));
      break;
    }
  }
  if (!favicon) favicon = abs(finalUrl, "/favicon.ico");

  // feeds
  const feeds = [];
  for (const t of tags(html, "link")) {
    const type = (attr(t, "type") || "").toLowerCase();
    if (type.includes("rss") || type.includes("atom")) {
      const f = abs(finalUrl, attr(t, "href"));
      if (f) feeds.push(f);
    }
  }

  // outbound personal-site links (hostnames, deduped, excluding socials/infra & self)
  const selfHost = new URL(finalUrl).hostname.replace(/^www\./, "");
  const outbound = new Set();
  const hrefRe = /href\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = hrefRe.exec(html))) {
    const href = m[2] ?? m[3] ?? "";
    if (!/^https?:\/\//i.test(href)) continue;
    let host;
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (host === selfHost) continue;
    if (NON_SITE_HOSTS.test(host)) continue;
    outbound.add(host);
  }

  // text snippet for later enrichment (strip tags/scripts)
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    ...site,
    finalUrl,
    title,
    description: decode(description),
    ogImage,
    favicon,
    feeds: [...new Set(feeds)],
    tech: detectTech(html, res.headers),
    outbound: [...outbound].slice(0, 40),
    textSnippet: text.slice(0, 1200),
    status: "ok",
  };
}

async function pool(items, n, worker) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx], idx);
      }
    })
  );
  return results;
}

async function main() {
  mkdirSync(SHOTS_DIR, { recursive: true });
  mkdirSync(dirname(OUT), { recursive: true });

  let sites = normalize(readSeeds());
  if (Number.isFinite(LIMIT)) sites = sites.slice(0, LIMIT);
  console.log(`Profiling ${sites.length} sites (concurrency ${CONCURRENCY}, shots: ${!NO_SHOTS})\n`);

  // 1) metadata
  const records = await pool(sites, CONCURRENCY, async (site) => {
    try {
      const r = await fetchMeta(site);
      console.log(`  meta  ok   ${site.host}  "${r.title.slice(0, 50)}"`);
      return r;
    } catch (e) {
      console.log(`  meta  FAIL ${site.host}  ${e.message}`);
      return { ...site, finalUrl: site.url, title: site.host, description: "", ogImage: null, favicon: abs(site.url, "/favicon.ico"), feeds: [], tech: [], outbound: [], textSnippet: "", status: "fetch_error" };
    }
  });

  // 2) screenshots
  if (!NO_SHOTS) {
    const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href);
    const browser = await chromium.launch({ headless: true });
    console.log(`\nCapturing screenshots...`);
    await pool(records, CONCURRENCY, async (rec) => {
      const file = `${rec.id}.jpg`;
      const path = join(SHOTS_DIR, file);
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        userAgent: UA,
      });
      const page = await ctx.newPage();
      try {
        await page.goto(rec.finalUrl, { waitUntil: "load", timeout: 20000 });
        await page.waitForTimeout(2500);
        await page.screenshot({ path, type: "jpeg", quality: 78 });
        rec.screenshot = `/shots/${file}`;
        console.log(`  shot  ok   ${rec.host}`);
      } catch (e) {
        rec.screenshot = null;
        console.log(`  shot  FAIL ${rec.host}  ${e.message.split("\n")[0]}`);
      } finally {
        await ctx.close();
      }
    });
    await browser.close();
  } else {
    for (const r of records) if (!("screenshot" in r)) r.screenshot = existsSync(join(SHOTS_DIR, `${r.id}.jpg`)) ? `/shots/${r.id}.jpg` : null;
  }

  writeFileSync(OUT, JSON.stringify(records, null, 2));
  const okShots = records.filter((r) => r.screenshot).length;
  console.log(`\nWrote ${records.length} records → ${OUT}`);
  console.log(`Screenshots: ${okShots}/${records.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
