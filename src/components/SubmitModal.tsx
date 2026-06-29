"use client";

import { useEffect, useRef, useState } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void };
  }
}

export default function SubmitModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const tsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load Cloudflare Turnstile only if a site key is configured.
  useEffect(() => {
    if (!SITE_KEY || !tsRef.current) return;
    const render = () => {
      if (window.turnstile && tsRef.current) {
        window.turnstile.render(tsRef.current, { sitekey: SITE_KEY, callback: (t: string) => setToken(t) });
      }
    };
    if (window.turnstile) render();
    else {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    }
  }, []);

  async function submit() {
    setState("sending");
    setMsg("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, name, note, website, turnstileToken: token }),
      });
      const data = await res.json();
      if (!data.ok) {
        setState("error");
        setMsg(data.error || "Something went wrong.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMsg("Network error. Try again.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {state === "done" ? (
          <div className="text-center py-6">
            <div className="text-[28px] mb-2">✓</div>
            <h2 className="text-[18px] font-semibold">Submitted for review</h2>
            <p className="text-[14px] mt-2" style={{ color: "var(--text-2)" }}>
              Thanks. Once it's approved it'll show up in the directory.
            </p>
            <button className="filter-pill mt-5" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-[18px] font-semibold">Add your site</h2>
            <p className="text-[13px] mt-1 mb-4" style={{ color: "var(--text-2)" }}>
              Personal websites only. It goes into a review queue before it's listed.
            </p>

            <label className="block text-[12px] mono uppercase tracking-wide mb-1" style={{ color: "var(--text-3)" }}>
              Website URL
            </label>
            <input
              className="search"
              placeholder="yourname.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />

            <label className="block text-[12px] mono uppercase tracking-wide mb-1 mt-3" style={{ color: "var(--text-3)" }}>
              Your name <span style={{ textTransform: "none" }}>(optional)</span>
            </label>
            <input className="search" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />

            <label className="block text-[12px] mono uppercase tracking-wide mb-1 mt-3" style={{ color: "var(--text-3)" }}>
              Anything to add? <span style={{ textTransform: "none" }}>(optional)</span>
            </label>
            <input
              className="search"
              placeholder="One line about the site"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {/* honeypot: hidden from humans, bots fill it */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />

            {SITE_KEY && <div ref={tsRef} className="mt-4" />}

            {msg && (
              <p className="text-[13px] mt-3" style={{ color: "#dc2626" }}>
                {msg}
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 text-center rounded-lg py-2.5 text-[14px] font-medium disabled:opacity-50"
                style={{ background: "var(--accent)", color: "var(--bg-card)" }}
                disabled={!url || state === "sending"}
                onClick={submit}
              >
                {state === "sending" ? "Submitting…" : "Submit for review"}
              </button>
              <button className="filter-pill" onClick={onClose}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
