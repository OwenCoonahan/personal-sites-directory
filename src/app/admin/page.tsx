"use client";

import { useEffect, useState, useCallback } from "react";

type Pending = { id: string; url: string; name?: string; note?: string; ip: string; ts: number };

export default function Admin() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(
    async (k: string) => {
      setError("");
      const res = await fetch("/api/admin", { headers: { "x-admin-key": k } });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Failed");
        setAuthed(false);
        return;
      }
      setAuthed(true);
      setPending(data.pending);
    },
    []
  );

  useEffect(() => {
    const saved = sessionStorage.getItem("hp-admin-key");
    if (saved) {
      setKey(saved);
      load(saved);
    }
  }, [load]);

  async function act(id: string, action: "approve" | "reject") {
    setBusy(id);
    setError("");
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "x-admin-key": key, "content-type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    const data = await res.json();
    setBusy(null);
    if (!data.ok) {
      setError(data.error || "Failed");
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-[20px] font-semibold mb-1">Homepages admin</h1>
          <p className="text-[13px] mb-4" style={{ color: "var(--text-2)" }}>
            Review the submission queue.
          </p>
          <input
            className="search"
            type="password"
            placeholder="Admin password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sessionStorage.setItem("hp-admin-key", key);
                load(key);
              }
            }}
          />
          {error && <p className="text-[12.5px] mt-2" style={{ color: "#dc2626" }}>{error}</p>}
          <button
            className="filter-pill mt-3 w-full"
            onClick={() => {
              sessionStorage.setItem("hp-admin-key", key);
              load(key);
            }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-[20px] font-semibold">Pending ({pending.length})</h1>
        <button className="filter-pill" onClick={() => load(key)}>
          Refresh
        </button>
      </div>
      {error && <p className="text-[13px] mb-3" style={{ color: "#dc2626" }}>{error}</p>}
      {pending.length === 0 ? (
        <p className="text-[14px] py-16 text-center" style={{ color: "var(--text-3)" }}>
          Queue is empty. 🎉
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((p) => (
            <div key={p.id} className="card p-4" style={{ cursor: "default" }}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <a href={p.url} target="_blank" rel="noreferrer" className="font-medium text-[15px] hover:underline">
                    {p.name || new URL(p.url).hostname}
                  </a>
                  <div className="text-[12.5px] mono mt-0.5" style={{ color: "var(--text-3)" }}>
                    {p.url}
                  </div>
                  {p.note && (
                    <p className="text-[13px] mt-1.5" style={{ color: "var(--text-2)" }}>
                      “{p.note}”
                    </p>
                  )}
                  <div className="text-[11px] mono mt-1" style={{ color: "var(--text-3)" }}>
                    {p.ip} · {new Date(p.ts * 1000).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="filter-pill"
                    data-active
                    disabled={busy === p.id}
                    onClick={() => act(p.id, "approve")}
                  >
                    {busy === p.id ? "…" : "Approve"}
                  </button>
                  <button className="filter-pill" disabled={busy === p.id} onClick={() => act(p.id, "reject")}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
