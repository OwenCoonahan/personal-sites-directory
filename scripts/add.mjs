#!/usr/bin/env node
// Incrementally add one (or more) sites to the directory — WITHOUT re-running
// the full profile.mjs sweep over all 83 sites (that re-screenshots everything
// and is exactly the heavy local Playwright job the machine-freeze rule avoids).
//
// For each URL this: appends it to seed-urls.txt (deduped), scrapes just that
// page's metadata, takes ONE screenshot (single page, browser closed right
// after), upserts into data/sites.raw.json + a stub in data/enrichment.json,
// then rebuilds data/sites.json (graph + in-degree).
//
//   node scripts/add.mjs https://jane.dev
//   node scripts/add.mjs https://a.com https://b.com     # several at once
//   node scripts/add.mjs https://jane.dev --no-shots     # skip screenshot
//   node scripts/add.mjs https://jane.dev --force        # re-scrape if it exists
//
// After it runs, the editorial fields (name/summary/role/tags/features) are
// filled in data/enrichment.json — hand-authored — then commit + push.
//
// The HTML-parsing + screenshot logic mirrors profile.mjs (kept standalone so
// this file has zero coupling to profile.mjs's all-sites run).

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHOTS_DIR = join(ROOT, "public", "shots");
const RAW = join(ROOT, "data", "sites.raw.json");
const ENRICH = join(ROOT, "data", "enrichment.json");
const SEEDS = join(__dirname, "seed-urls.txt");
const PLAYWRIGHT = "/Users/owencoonahan/Documents/Grand Library/node_modules/playwright/index.mjs";

const args = process.argv.slice(2);
const NO_SHOTS = args.includes("--no-shots");
const FORCE = args.includes("--force");
const urls = args.filter((a) => !a.startsWith("--"));
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const NON_SITE_HOSTS =
  /(twitter|x|linkedin|github|instagram|facebook|youtube|youtu\.be|tiktok|medium|substack|notion|bsky|threads|mastodon|t\.co|goo\.gl|bit\.ly|google|gstatic|gravatar|cloudflare|vercel|netlify|cdn|fonts|gmail|mailto|calendly|stripe|paypal|patreon|buymeacoffee|spotify|apple|amazon|reddit|discord|telegram|whatsapp|figma|dribbble|behance|producthunt|hackernews|news\.ycombinator)/i;

const slug = (host) => host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

function tagsOf(html, name) {
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
function decode(s) {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").trim();
}
function metaContent(html, keyVal) {
  for (const t of tagsOf(html, "meta")) {
    const n = (attr(t, "name") || attr(t, "property") || "").toLowerCase();
    if (n === keyVal) return decode(attr(t, "content") || "");
  }
  return null;
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
  if (server.includes("vercel") || headers.get("x-vercel-id")) t.add("Vercel");
  if (powered.includes("framer") || h.includes("framerusercontent")) t.add("Framer");
  if (h.includes("squarespace")) t.add("Squarespace");
  if (h.includes("cdn.shopify")) t.add("Shopify");
  return [...t];
}

function normalizeUrl(raw) {
  let u;
  try {
    u = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname;
  const isRoot = u.pathname === "/" || u.pathname === "";
  return { id: slug(host), host, url: `${u.protocol}//${host}${isRoot ? "/" : u.pathname}` };
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

  let favicon = null;
  for (const t of tagsOf(html, "link")) {
    const rel = (attr(t, "rel") || "").toLowerCase();
    if (rel.includes("icon")) {
      favicon = abs(finalUrl, attr(t, "href"));
      break;
    }
  }
  if (!favicon) favicon = abs(finalUrl, "/favicon.ico");

  const feeds = [];
  for (const t of tagsOf(html, "link")) {
    const type = (attr(t, "type") || "").toLowerCase();
    if (type.includes("rss") || type.includes("atom")) {
      const f = abs(finalUrl, attr(t, "href"));
      if (f) feeds.push(f);
    }
  }

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

async function screenshot(rec) {
  const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href);
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, userAgent: UA });
    const page = await ctx.newPage();
    const path = join(SHOTS_DIR, `${rec.id}.jpg`);
    try {
      await page.goto(rec.finalUrl, { waitUntil: "load", timeout: 20000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path, type: "jpeg", quality: 78 });
      rec.screenshot = `/shots/${rec.id}.jpg`;
      console.log(`  shot  ok   ${rec.host}`);
    } catch (e) {
      rec.screenshot = existsSync(path) ? `/shots/${rec.id}.jpg` : null;
      console.log(`  shot  FAIL ${rec.host}  ${e.message.split("\n")[0]}`);
    } finally {
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!urls.length) {
    console.error("Usage: node scripts/add.mjs <url> [<url> ...] [--no-shots] [--force]");
    process.exit(1);
  }
  mkdirSync(SHOTS_DIR, { recursive: true });

  const raw = existsSync(RAW) ? JSON.parse(readFileSync(RAW, "utf8")) : [];
  const enrich = existsSync(ENRICH) ? JSON.parse(readFileSync(ENRICH, "utf8")) : {};
  const rawById = new Map(raw.map((r) => [r.id, r]));
  const seedText = existsSync(SEEDS) ? readFileSync(SEEDS, "utf8") : "";
  const seedHosts = new Set(
    seedText.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => normalizeUrl(l)?.host).filter(Boolean)
  );

  for (const input of urls) {
    const site = normalizeUrl(input);
    if (!site) {
      console.log(`  skip  bad url: ${input}`);
      continue;
    }
    if (rawById.has(site.id) && !FORCE) {
      console.log(`  skip  already listed: ${site.host} (use --force to re-scrape)`);
      continue;
    }
    console.log(`\nAdding ${site.host}`);

    let rec;
    try {
      rec = await fetchMeta(site);
      console.log(`  meta  ok   "${rec.title.slice(0, 60)}"`);
    } catch (e) {
      console.log(`  meta  FAIL ${site.host}  ${e.message}`);
      rec = { ...site, finalUrl: site.url, title: site.host, description: "", ogImage: null, favicon: abs(site.url, "/favicon.ico"), feeds: [], tech: [], outbound: [], textSnippet: "", status: "fetch_error" };
    }

    if (!NO_SHOTS) await screenshot(rec);
    else rec.screenshot = existsSync(join(SHOTS_DIR, `${rec.id}.jpg`)) ? `/shots/${rec.id}.jpg` : null;

    // upsert raw
    if (rawById.has(rec.id)) {
      const i = raw.findIndex((r) => r.id === rec.id);
      raw[i] = rec;
    } else {
      raw.push(rec);
    }
    rawById.set(rec.id, rec);

    // stub enrichment (only if none yet) — hand-edit these after
    if (!enrich[rec.id]) {
      const name = (rec.title || "").split(/[|–—\-·:]/)[0].trim();
      enrich[rec.id] = {
        name: name && name.length <= 40 ? name : rec.host.replace(/^www\./, ""),
        summary: "",
        role: "",
        tags: [],
        features: rec.feeds?.length ? ["Blog"] : [],
      };
      console.log(`  enrich  stub written (fill summary/role/tags in data/enrichment.json)`);
    }

    // seed list
    if (!seedHosts.has(site.host)) {
      appendFileSync(SEEDS, `${seedText.endsWith("\n") || !seedText ? "" : "\n"}${site.url}\n`);
      seedHosts.add(site.host);
    }

    // echo the scraped context so the editorial fields can be written well
    console.log(`  ── context ──`);
    console.log(`  title: ${rec.title}`);
    console.log(`  desc:  ${rec.description?.slice(0, 160) || "—"}`);
    console.log(`  tech:  ${rec.tech.join(", ") || "—"}`);
    console.log(`  text:  ${rec.textSnippet?.slice(0, 240) || "—"}`);
  }

  writeFileSync(RAW, JSON.stringify(raw, null, 2));
  writeFileSync(ENRICH, JSON.stringify(enrich, null, 2));

  // rebuild sites.json (graph + in-degree). build-data.mjs runs on import.
  await import(pathToFileURL(join(__dirname, "build-data.mjs")).href);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
