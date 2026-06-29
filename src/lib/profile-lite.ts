import type { Site } from "./types";

// Serverless-safe profiler: fetch + parse metadata only (no headless browser).
// Screenshot uses WordPress mShots (free, no key). The local Playwright pipeline
// (scripts/profile.mjs) can backfill higher-quality shots for approved sites later.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const NON_SITE_HOSTS =
  /(twitter|x|linkedin|github|instagram|facebook|youtube|youtu\.be|tiktok|medium|substack|notion|bsky|threads|mastodon|t\.co|goo\.gl|bit\.ly|google|gstatic|gravatar|cloudflare|vercel|netlify|cdn|fonts|gmail|mailto|calendly|stripe|paypal|patreon|buymeacoffee|spotify|apple|amazon|reddit|discord|telegram|whatsapp|figma|dribbble|behance|producthunt)/i;

function decode(s: string) {
  return (s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").trim();
}
function tagList(html: string, name: string) {
  const out: string[] = [];
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  let m;
  while ((m = re.exec(html))) out.push(m[0]);
  return out;
}
function attr(tag: string, key: string) {
  const m = tag.match(new RegExp(`\\b${key}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "").trim() : null;
}
function metaContent(html: string, keyVal: string) {
  for (const t of tagList(html, "meta")) {
    const n = (attr(t, "name") || attr(t, "property") || "").toLowerCase();
    if (n === keyVal) return decode(attr(t, "content") || "");
  }
  return null;
}
function abs(base: string, href: string | null) {
  if (!href) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}
function slug(host: string) {
  return host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}
function detectTech(html: string, headers: Headers) {
  const t = new Set<string>();
  const h = html.toLowerCase();
  const gen = (metaContent(html, "generator") || "").toLowerCase();
  if (h.includes("__next_data__") || h.includes("/_next/") || gen.includes("next")) t.add("Next.js");
  if (gen.includes("gatsby")) t.add("Gatsby");
  if (gen.includes("hugo")) t.add("Hugo");
  if (gen.includes("jekyll")) t.add("Jekyll");
  if (gen.includes("astro") || h.includes("astro-")) t.add("Astro");
  if (gen.includes("wordpress") || h.includes("wp-content")) t.add("WordPress");
  if (gen.includes("ghost")) t.add("Ghost");
  if (h.includes("three.module") || h.includes("webgl")) t.add("WebGL/Three.js");
  if (h.includes("framerusercontent")) t.add("Framer");
  if (headers.get("x-vercel-id")) t.add("Vercel");
  return [...t];
}

export function shotUrl(url: string) {
  return `https://s.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=800`;
}

export async function profileLite(rawUrl: string): Promise<Site> {
  const u = new URL(rawUrl);
  const host = u.hostname;
  const res = await fetch(u.href, {
    headers: { "user-agent": UA, accept: "text/html,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
  });
  const finalUrl = res.url || u.href;
  const html = await res.text();

  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " "));
  const description =
    metaContent(html, "description") || metaContent(html, "og:description") || metaContent(html, "twitter:description") || "";
  const ogImage = metaContent(html, "og:image") || metaContent(html, "twitter:image") || null;

  let favicon: string | null = null;
  for (const t of tagList(html, "link")) {
    if ((attr(t, "rel") || "").toLowerCase().includes("icon")) {
      favicon = abs(finalUrl, attr(t, "href"));
      break;
    }
  }
  if (!favicon) favicon = abs(finalUrl, "/favicon.ico");

  const feeds: string[] = [];
  for (const t of tagList(html, "link")) {
    const type = (attr(t, "type") || "").toLowerCase();
    if (type.includes("rss") || type.includes("atom")) {
      const f = abs(finalUrl, attr(t, "href"));
      if (f) feeds.push(f);
    }
  }

  const selfHost = host.replace(/^www\./, "");
  const outbound = new Set<string>();
  const hrefRe = /href\s*=\s*("([^"]*)"|'([^']*)')/gi;
  let m;
  while ((m = hrefRe.exec(html))) {
    const href = m[2] ?? m[3] ?? "";
    if (!/^https?:\/\//i.test(href)) continue;
    let hh;
    try {
      hh = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (hh === selfHost || NON_SITE_HOSTS.test(hh)) continue;
    outbound.add(hh);
  }

  const name = (() => {
    const t = title.split(/[|–—\-·:]/)[0].trim();
    return t && t.length <= 40 && !/^https?:/i.test(t) ? t : selfHost;
  })();

  return {
    id: slug(host),
    url: u.href,
    host,
    finalUrl,
    name,
    title,
    summary: decode(description),
    description: decode(description),
    screenshot: shotUrl(finalUrl),
    ogImage,
    favicon,
    role: "",
    tags: [],
    features: feeds.length ? ["Blog"] : [],
    tech: detectTech(html, res.headers),
    feeds: [...new Set(feeds)],
    outbound: [...outbound].slice(0, 40),
    links: [],
    inDegree: 0,
    status: "community",
  };
}
