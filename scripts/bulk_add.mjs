#!/usr/bin/env node
// Bulk-add many URLs at once (for aggregator imports). Concurrent metadata +
// concurrent screenshots via a SHARED browser (pool of 4), so hundreds of
// sites take ~15 min instead of ~70. Freeze-safe: one browser, few pages.
//
//   node scripts/bulk_add.mjs /tmp/agg_live.txt
//
// Upserts data/sites.raw.json + appends to seed-urls.txt. Does NOT write
// enrichment (run scripts/auto_enrich.mjs after). Mirrors add.mjs's scraping.

import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SHOTS_DIR = join(ROOT, "public", "shots");
const RAW = join(ROOT, "data", "sites.raw.json");
const SEEDS = join(__dirname, "seed-urls.txt");
const PLAYWRIGHT = "/Users/owencoonahan/Documents/Grand Library/node_modules/playwright/index.mjs";
const LIST = process.argv[2];
const META_CONC = 12, SHOT_CONC = 4;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const NON_SITE_HOSTS = /(twitter|x|linkedin|github|instagram|facebook|youtube|youtu\.be|tiktok|medium|substack|notion|bsky|threads|mastodon|t\.co|goo\.gl|bit\.ly|google|gstatic|gravatar|cloudflare|vercel|netlify|cdn|fonts|gmail|mailto|calendly|stripe|paypal|patreon|buymeacoffee|spotify|apple|amazon|reddit|discord|telegram|whatsapp|figma|dribbble|behance|producthunt|hackernews|news\.ycombinator)/i;

const slug = (host) => host.replace(/^www\./, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
function tagsOf(html, name) { const out=[]; const re=new RegExp(`<${name}\\b[^>]*>`,"gi"); let m; while((m=re.exec(html)))out.push(m[0]); return out; }
function attr(tag, key){ const m=tag.match(new RegExp(`\\b${key}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,"i")); return m?(m[2]??m[3]??m[4]??"").trim():null; }
function decode(s){ return (s||"").replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim(); }
function metaContent(html, keyVal){ for(const t of tagsOf(html,"meta")){ const n=(attr(t,"name")||attr(t,"property")||"").toLowerCase(); if(n===keyVal)return decode(attr(t,"content")||""); } return null; }
function abs(base, href){ try{ return new URL(href,base).href; }catch{ return null; } }
function detectTech(html, headers){ const t=new Set(); const h=html.toLowerCase(); const gen=(metaContent(html,"generator")||"").toLowerCase(); const powered=(headers.get("x-powered-by")||"").toLowerCase(); const server=(headers.get("server")||"").toLowerCase();
  if(h.includes("__next_data__")||h.includes("/_next/")||gen.includes("next"))t.add("Next.js"); if(h.includes("/_nuxt/")||gen.includes("nuxt"))t.add("Nuxt"); if(gen.includes("gatsby"))t.add("Gatsby"); if(gen.includes("hugo"))t.add("Hugo"); if(gen.includes("jekyll"))t.add("Jekyll"); if(gen.includes("astro")||h.includes("astro-"))t.add("Astro"); if(gen.includes("wordpress")||h.includes("wp-content"))t.add("WordPress"); if(gen.includes("ghost"))t.add("Ghost"); if(gen.includes("svelte")||h.includes("svelte"))t.add("Svelte"); if(h.includes("data-reactroot")||h.includes("react"))t.add("React"); if(server.includes("vercel")||headers.get("x-vercel-id"))t.add("Vercel"); if(powered.includes("framer")||h.includes("framerusercontent"))t.add("Framer"); return [...t]; }

function normalizeUrl(raw){ let u; try{ u=new URL(raw.includes("://")?raw:`https://${raw}`);}catch{return null;} const host=u.hostname; const isRoot=u.pathname==="/"||u.pathname===""; return {id:slug(host),host,url:`${u.protocol}//${host}${isRoot?"/":u.pathname}`}; }

async function fetchMeta(site){
  const res=await fetch(site.url,{headers:{"user-agent":UA,accept:"text/html,*/*"},redirect:"follow",signal:AbortSignal.timeout(18000)});
  const finalUrl=res.url||site.url; const html=await res.text();
  const title=decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/\s+/g," "));
  const description=metaContent(html,"description")||metaContent(html,"og:description")||metaContent(html,"twitter:description")||"";
  const ogImage=metaContent(html,"og:image")||metaContent(html,"twitter:image")||null;
  let favicon=null; for(const t of tagsOf(html,"link")){ const rel=(attr(t,"rel")||"").toLowerCase(); if(rel.includes("icon")){ favicon=abs(finalUrl,attr(t,"href")); break; } } if(!favicon)favicon=abs(finalUrl,"/favicon.ico");
  const feeds=[]; for(const t of tagsOf(html,"link")){ const type=(attr(t,"type")||"").toLowerCase(); if(type.includes("rss")||type.includes("atom")){ const f=abs(finalUrl,attr(t,"href")); if(f)feeds.push(f); } }
  const selfHost=new URL(finalUrl).hostname.replace(/^www\./,""); const outbound=new Set(); const hrefRe=/href\s*=\s*("([^"]*)"|'([^']*)')/gi; let m;
  while((m=hrefRe.exec(html))){ const href=m[2]??m[3]??""; if(!/^https?:\/\//i.test(href))continue; let host; try{host=new URL(href).hostname.replace(/^www\./,"");}catch{continue;} if(host===selfHost)continue; if(NON_SITE_HOSTS.test(host))continue; outbound.add(host); }
  const text=html.replace(/<script[\s\S]*?<\/script>/gi," ").replace(/<style[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  return {...site,finalUrl,title,description:decode(description),ogImage,favicon,feeds:[...new Set(feeds)],tech:detectTech(html,res.headers),outbound:[...outbound].slice(0,40),textSnippet:text.slice(0,1200),status:"ok"};
}
async function pool(items,n,worker){ const out=new Array(items.length); let i=0; await Promise.all(Array.from({length:Math.min(n,items.length)},async()=>{ while(i<items.length){ const idx=i++; out[idx]=await worker(items[idx],idx); } })); return out; }

async function main(){
  mkdirSync(SHOTS_DIR,{recursive:true});
  const raw=existsSync(RAW)?JSON.parse(readFileSync(RAW,"utf8")):[];
  const have=new Set(raw.map(r=>r.id));
  const seedHosts=new Set((existsSync(SEEDS)?readFileSync(SEEDS,"utf8"):"").split("\n").map(l=>{try{return new URL(l.trim()).hostname;}catch{return null;}}).filter(Boolean));
  let sites=readFileSync(LIST,"utf8").split("\n").map(s=>s.trim()).filter(Boolean).map(normalizeUrl).filter(Boolean);
  // dedup within list + against existing
  const seen=new Set(); sites=sites.filter(s=>{ if(have.has(s.id)||seen.has(s.id))return false; seen.add(s.id); return true; });
  console.log(`bulk: ${sites.length} new sites to scrape (meta ${META_CONC}, shots ${SHOT_CONC})`);

  let done=0;
  const records=await pool(sites,META_CONC,async(s)=>{ try{ const r=await fetchMeta(s); return r; }catch(e){ return {...s,finalUrl:s.url,title:s.host,description:"",ogImage:null,favicon:abs(s.url,"/favicon.ico"),feeds:[],tech:[],outbound:[],textSnippet:"",status:"fetch_error"}; } finally { if(++done%50===0)console.log(`  meta ${done}/${sites.length}`); } });

  const { chromium } = await import(pathToFileURL(PLAYWRIGHT).href);
  const browser = await chromium.launch({ headless:true });
  let sdone=0;
  await pool(records,SHOT_CONC,async(rec)=>{
    const path=join(SHOTS_DIR,`${rec.id}.jpg`);
    const ctx=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,userAgent:UA});
    const page=await ctx.newPage();
    try{ await page.goto(rec.finalUrl,{waitUntil:"load",timeout:20000}); await page.waitForTimeout(2200); await page.screenshot({path,type:"jpeg",quality:78}); rec.screenshot=`/shots/${rec.id}.jpg`; }
    catch{ rec.screenshot=existsSync(path)?`/shots/${rec.id}.jpg`:null; }
    finally{ await ctx.close(); if(++sdone%50===0)console.log(`  shots ${sdone}/${records.length}`); }
  });
  await browser.close();

  for(const rec of records){ raw.push(rec); if(!seedHosts.has(rec.host)){ appendFileSync(SEEDS,`${rec.url}\n`); seedHosts.add(rec.host); } }
  writeFileSync(RAW, JSON.stringify(raw,null,2));
  const okShots=records.filter(r=>r.screenshot).length;
  console.log(`\nadded ${records.length} records (raw now ${raw.length}). screenshots: ${okShots}/${records.length}`);
}
main().catch(e=>{ console.error(e); process.exit(1); });
