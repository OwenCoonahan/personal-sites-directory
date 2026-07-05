"use client";

import { useEffect, useState } from "react";

// Where suggestions go. Configured via NEXT_PUBLIC_FORMSPREE_ID (the part after
// /f/ in https://formspree.io/f/XXXXXXXX), set in Vercel. If it's ever unset,
// the form gracefully falls back to opening a pre-filled email instead.
const FORM_ID = process.env.NEXT_PUBLIC_FORMSPREE_ID;
const FALLBACK_EMAIL = "3owen.c@gmail.com";

export default function SubmitModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [gotcha, setGotcha] = useState(""); // honeypot — bots fill it, humans don't
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (gotcha) return; // silently ignore bots
    setState("sending");
    setMsg("");

    // No Formspree configured → fall back to a pre-filled email.
    if (!FORM_ID) {
      const body = `Site: ${url}\nName: ${name}\nNote: ${note}`;
      window.location.href = `mailto:${FALLBACK_EMAIL}?subject=${encodeURIComponent(
        "New site for the directory"
      )}&body=${encodeURIComponent(body)}`;
      setState("done");
      return;
    }

    try {
      const res = await fetch(`https://formspree.io/f/${FORM_ID}`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ url, name, note, _subject: "New site for the directory" }),
      });
      if (res.ok) {
        setState("done");
      } else {
        setState("error");
        setMsg("Couldn't send that. Try again, or email me directly.");
      }
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
            <h2 className="text-[18px] font-semibold">Thanks for the suggestion</h2>
            <p className="text-[14px] mt-2" style={{ color: "var(--text-2)" }}>
              I read every one and add the good ones to the directory.
            </p>
            <button className="filter-pill mt-5" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-[18px] font-semibold">Suggest a site</h2>
            <p className="text-[13px] mt-1 mb-4" style={{ color: "var(--text-2)" }}>
              Personal websites only. Send it over and I'll add it if it's a fit.
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
              value={gotcha}
              onChange={(e) => setGotcha(e.target.value)}
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              aria-hidden="true"
            />

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
                {state === "sending" ? "Sending…" : "Send"}
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
