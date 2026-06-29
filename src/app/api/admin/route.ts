import { NextResponse } from "next/server";
import { addApproved, listPending, removePending } from "@/lib/store";
import { profileLite } from "@/lib/profile-lite";

export const runtime = "nodejs";

function authed(req: Request) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null; // not configured
  return req.headers.get("x-admin-key") === pw;
}

export async function GET(req: Request) {
  const ok = authed(req);
  if (ok === null) return NextResponse.json({ ok: false, error: "Admin not configured (set ADMIN_PASSWORD)." }, { status: 500 });
  if (!ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, pending: await listPending() });
}

export async function POST(req: Request) {
  const ok = authed(req);
  if (ok === null) return NextResponse.json({ ok: false, error: "Admin not configured (set ADMIN_PASSWORD)." }, { status: 500 });
  if (!ok) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { action, id } = (await req.json()) as { action: string; id: string };
  const pending = await listPending();
  const item = pending.find((p) => p.id === id);
  if (!item) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });

  if (action === "reject") {
    await removePending(id);
    return NextResponse.json({ ok: true });
  }

  if (action === "approve") {
    try {
      const site = await profileLite(item.url);
      // Prefer the submitter's name if they provided one.
      if (item.name) site.name = item.name;
      await addApproved(site);
      await removePending(id);
      return NextResponse.json({ ok: true, site });
    } catch (e) {
      return NextResponse.json({ ok: false, error: `Profiling failed: ${(e as Error).message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
