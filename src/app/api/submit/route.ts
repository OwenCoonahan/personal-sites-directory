import { NextResponse } from "next/server";
import { addPending, listApproved, listPending, rateLimit } from "@/lib/store";
import { seedHosts } from "@/lib/sites";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return true; // not configured (local/dev) → skip
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success: boolean };
    return data.success;
  } catch {
    return false;
  }
}

function normalizeUrl(input: string): URL | null {
  let s = (input || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname.includes(".")) return null;
    return u;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";

  let body: { url?: string; name?: string; note?: string; website?: string; turnstileToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }

  // Honeypot: real users never fill this hidden field. Pretend success.
  if (body.website && body.website.trim()) {
    return NextResponse.json({ ok: true, queued: false });
  }

  if (!(await verifyTurnstile(body.turnstileToken, ip))) {
    return NextResponse.json({ ok: false, error: "Bot check failed. Please retry." }, { status: 403 });
  }

  if (!(await rateLimit(ip, 3, 86400))) {
    return NextResponse.json(
      { ok: false, error: "You've submitted a few already today. Try again tomorrow." },
      { status: 429 }
    );
  }

  const u = normalizeUrl(body.url || "");
  if (!u) {
    return NextResponse.json({ ok: false, error: "That doesn't look like a valid URL." }, { status: 400 });
  }

  const host = u.hostname.replace(/^www\./, "");

  // Dedupe against seed, approved, and the pending queue.
  if (seedHosts().has(host)) {
    return NextResponse.json({ ok: false, error: "That site is already in the directory." }, { status: 409 });
  }
  const [approved, pending] = await Promise.all([listApproved(), listPending()]);
  if (approved.some((s) => s.host.replace(/^www\./, "") === host)) {
    return NextResponse.json({ ok: false, error: "That site is already in the directory." }, { status: 409 });
  }
  if (pending.some((p) => new URL(p.url).hostname.replace(/^www\./, "") === host)) {
    return NextResponse.json({ ok: false, error: "That site is already pending review." }, { status: 409 });
  }

  // Reachability: must return HTML. Kills dead links and non-sites.
  try {
    const res = await fetch(u.href, {
      headers: { "user-agent": UA, accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    const ct = res.headers.get("content-type") || "";
    if (!res.ok || !ct.includes("text/html")) {
      return NextResponse.json({ ok: false, error: "Couldn't reach a normal web page at that URL." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "That URL didn't respond. Check it and retry." }, { status: 400 });
  }

  await addPending({
    id: `${host}-${ip.replace(/[^a-z0-9]/gi, "")}-${pending.length}`,
    url: u.href,
    name: (body.name || "").slice(0, 80) || undefined,
    note: (body.note || "").slice(0, 280) || undefined,
    ip,
    ts: Math.floor(Date.now() / 1000),
  });

  return NextResponse.json({ ok: true, queued: true });
}
