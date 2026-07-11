"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Site } from "@/lib/types";
import SiteCard from "./SiteCard";
import SiteDetail from "./SiteDetail";
import SubmitModal from "./SubmitModal";

type Facet = { value: string; n: number };
type Facets = { roles: Facet[]; tags: Facet[]; features: Facet[] };
type Sort = "az" | "random";

const SORT_LABEL: Record<Sort, string> = { az: "A–Z", random: "Shuffle" };

export default function Directory({ sites, facets }: { sites: Site[]; facets: Facets }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [feature, setFeature] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>("az");
  const [seed, setSeed] = useState(0);
  const [open, setOpen] = useState<Site | null>(null);
  const [showAllTags, setShowAllTags] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [notableOnly, setNotableOnly] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(sites.map((s) => [s.id, s])), [sites]);

  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const clearAll = () => {
    setQ("");
    setRole(null);
    setFeature(null);
    setTags([]);
    setNotableOnly(false);
  };

  // Close the sort dropdown on outside-click / Escape.
  useEffect(() => {
    if (!sortOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSortOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortOpen]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = sites.filter((s) => {
      if (notableOnly && !s.notable) return false;
      if (role && s.role !== role) return false;
      if (feature && !s.features.includes(feature)) return false;
      if (tags.length && !tags.every((t) => s.tags.includes(t))) return false;
      if (needle) {
        const hay = `${s.name} ${s.summary} ${s.description} ${s.host} ${s.tags.join(" ")} ${s.role}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    if (sort === "az") out = [...out].sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "random") out = shuffle(out, seed);
    return out;
  }, [sites, q, role, feature, tags, sort, seed, notableOnly]);

  const activeFilters = (role ? 1 : 0) + (feature ? 1 : 0) + tags.length;
  const topTags = showAllTags ? facets.tags : facets.tags.slice(0, 12);

  const pickSort = (s: Sort) => {
    setSort(s);
    if (s === "random") setSeed((n) => n + 1);
    setSortOpen(false);
  };

  // Open a random site (from the currently-visible set) in a new tab — for fun.
  const openRandom = () => {
    const pool = filtered.length ? filtered : sites;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) window.open(pick.finalUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-5 md:px-8 pt-8 pb-5 max-w-[1400px] mx-auto w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mac-hello.png" alt="A classic Macintosh saying hello" className="h-16 sm:h-20 md:h-28 w-auto mb-3 md:mb-4 select-none" draggable={false} />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="wordmark text-[24px] md:text-[30px] font-semibold tracking-tight" style={{ color: "var(--text-1)" }}>
              {"Homepages".split("").map((ch, i) => (
                <span key={i} style={{ animationDelay: `${i * 45}ms` }}>
                  {ch}
                </span>
              ))}
            </h1>
            <p className="text-[13.5px] md:text-[14px] mt-1" style={{ color: "var(--text-2)" }}>
              A directory of personal websites from the people building the internet.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openRandom}
              className="rounded-lg px-3 py-2 text-[13px] font-medium"
              style={{ background: "var(--bg-card)", color: "var(--text-1)", border: "1px solid var(--border-strong)" }}
              title="Open a random site in a new tab"
            >
              🎲 Random
            </button>
            <button
              onClick={() => setSubmitOpen(true)}
              className="rounded-lg px-3.5 py-2 text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "var(--bg-card)" }}
            >
              + Add site
            </button>
          </div>
        </div>
      </header>

      {/* Control bar */}
      <div
        className="sticky top-0 z-30"
        style={{
          background: "color-mix(in srgb, var(--bg) 88%, transparent)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="px-5 md:px-8 py-3 max-w-[1400px] mx-auto w-full flex flex-col gap-2.5">
          {/* one compact row: search · filters · sort */}
          <div className="flex items-center gap-2">
            <input
              className="search"
              style={{ flex: 1, minWidth: 0 }}
              placeholder="Search names, topics, sites…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button
              className="filter-pill shrink-0"
              data-active={notableOnly}
              onClick={() => setNotableOnly((v) => !v)}
              title="Show only well-known people (CEOs, founders, notable individuals)"
            >
              <span aria-hidden>★</span> Famous
            </button>
            <button
              className="filter-pill shrink-0"
              data-active={filtersOpen || activeFilters > 0}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              Filters{activeFilters > 0 && <span style={{ opacity: 0.7 }}> · {activeFilters}</span>}
            </button>
            <div className="relative shrink-0" ref={sortRef}>
              <button className="filter-pill" data-active={sortOpen} onClick={() => setSortOpen((v) => !v)}>
                {SORT_LABEL[sort]} <span style={{ opacity: 0.5, fontSize: 10 }}>▾</span>
              </button>
              {sortOpen && (
                <div
                  className="absolute right-0 mt-1.5 p-1 z-40"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: 10,
                    boxShadow: "var(--shadow)",
                    minWidth: 140,
                  }}
                >
                  {(["az", "random"] as Sort[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => pickSort(s)}
                      className="block w-full text-left rounded-md px-2.5 py-1.5 text-[13px]"
                      style={{
                        color: sort === s ? "var(--text-1)" : "var(--text-2)",
                        background: sort === s ? "var(--chip)" : "transparent",
                        fontWeight: sort === s ? 600 : 400,
                      }}
                    >
                      {SORT_LABEL[s]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* active filters summary (when the panel is closed) */}
          {activeFilters > 0 && !filtersOpen && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {role && <RemovableChip label={role} onRemove={() => setRole(null)} />}
              {feature && <RemovableChip label={feature} onRemove={() => setFeature(null)} />}
              {tags.map((t) => (
                <RemovableChip key={t} label={t} onRemove={() => toggleTag(t)} />
              ))}
              <button className="text-[12.5px] hover:underline ml-0.5" style={{ color: "var(--text-3)" }} onClick={clearAll}>
                Clear
              </button>
            </div>
          )}

          {/* collapsible filter panel */}
          {filtersOpen && (
            <div className="flex flex-col gap-3 pt-1 pb-1.5">
              <FilterGroup label="Role">
                {facets.roles.slice(0, 7).map((r) => (
                  <button
                    key={r.value}
                    className="filter-pill"
                    data-active={role === r.value}
                    onClick={() => setRole(role === r.value ? null : r.value)}
                    style={{ fontSize: 12 }}
                  >
                    {r.value} <span style={{ opacity: 0.5 }}>{r.n}</span>
                  </button>
                ))}
              </FilterGroup>

              <FilterGroup label="Has">
                {facets.features.map((f) => (
                  <button
                    key={f.value}
                    className="filter-pill"
                    data-active={feature === f.value}
                    onClick={() => setFeature(feature === f.value ? null : f.value)}
                    style={{ fontSize: 12 }}
                  >
                    {f.value}
                  </button>
                ))}
              </FilterGroup>

              <FilterGroup label="Topic">
                {topTags.map((t) => (
                  <button
                    key={t.value}
                    className="filter-pill"
                    data-active={tags.includes(t.value)}
                    onClick={() => toggleTag(t.value)}
                    style={{ fontSize: 12 }}
                  >
                    {t.value}
                  </button>
                ))}
                {facets.tags.length > 12 && (
                  <button className="filter-pill" style={{ fontSize: 12 }} onClick={() => setShowAllTags((v) => !v)}>
                    {showAllTags ? "less" : `+${facets.tags.length - 12} more`}
                  </button>
                )}
              </FilterGroup>

              {activeFilters > 0 && (
                <button className="text-[12.5px] hover:underline self-start" style={{ color: "var(--text-3)" }} onClick={clearAll}>
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <main className="px-5 md:px-8 py-6 max-w-[1400px] mx-auto w-full flex-1">
        <div className="mb-4">
          <span className="text-[13px] mono" style={{ color: "var(--text-3)" }}>
            {filtered.length} {filtered.length === 1 ? "site" : "sites"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="py-24 text-center text-[14px]" style={{ color: "var(--text-3)" }}>
            No sites match those filters.
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((s) => (
              <SiteCard key={s.id} site={s} onOpen={setOpen} />
            ))}
          </div>
        )}
      </main>

      <footer className="px-5 md:px-8 py-8 max-w-[1400px] mx-auto w-full text-[12.5px]" style={{ color: "var(--text-3)" }}>
        Homepages · {sites.length} personal sites and growing · made by{" "}
        <a href="https://owencoonahan.xyz" target="_blank" rel="noreferrer" className="host-link">
          Owen Coonahan <span aria-hidden style={{ opacity: 0.6 }}>↗</span>
        </a>
      </footer>

      {open && <SiteDetail site={open} byId={byId} onClose={() => setOpen(null)} onOpen={setOpen} />}
      {submitOpen && <SubmitModal onClose={() => setSubmitOpen(false)} />}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="mono text-[10.5px] uppercase tracking-wide shrink-0 w-10" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

function RemovableChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      className="filter-pill"
      data-active="true"
      onClick={onRemove}
      style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
    >
      {label}
      <span aria-hidden style={{ opacity: 0.7 }}>
        ✕
      </span>
    </button>
  );
}

// deterministic shuffle (seeded) so SSR/CSR stay consistent until the user reshuffles
function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed * 9301 + 49297;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
