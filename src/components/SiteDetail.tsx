"use client";

import { useEffect } from "react";
import type { Site } from "@/lib/types";

export default function SiteDetail({
  site,
  byId,
  onClose,
  onOpen,
}: {
  site: Site;
  byId: Map<string, Site>;
  onClose: () => void;
  onOpen: (s: Site) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const img = site.screenshot || site.ogImage;
  const related = site.links.map((id) => byId.get(id)).filter(Boolean) as Site[];
  const linkedBy = [...byId.values()].filter((s) => s.links.includes(site.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 md:p-8 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl overflow-hidden my-auto"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shot" style={{ aspectRatio: "16 / 9" }}>
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt={site.name} />
          ) : (
            <div className="flex items-center justify-center w-full h-full mono text-5xl" style={{ color: "var(--text-3)" }}>
              {site.name.slice(0, 1)}
            </div>
          )}
        </div>

        <div className="p-5 md:p-6">
          <div className="flex items-start gap-3">
            {site.favicon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={site.favicon} alt="" width={28} height={28} className="rounded mt-0.5" style={{ objectFit: "cover" }} />
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-[20px] font-semibold leading-tight" style={{ color: "var(--text-1)" }}>
                {site.name}
              </h2>
              <a
                href={site.finalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[13px] mono hover:underline"
                style={{ color: "var(--text-3)" }}
              >
                {site.host.replace(/^www\./, "")}
              </a>
            </div>
            <button onClick={onClose} className="close-btn shrink-0" aria-label="Close">
              ✕
            </button>
          </div>

          <p className="text-[14px] mt-3 leading-relaxed" style={{ color: "var(--text-2)" }}>
            {site.summary || site.description}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-4">
            {site.role && <span className="chip" style={{ background: "var(--accent)", color: "var(--bg-card)" }}>{site.role}</span>}
            {site.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-5 text-[12.5px]">
            {site.features.length > 0 && (
              <Meta label="Has">
                {site.features.join(" · ")}
              </Meta>
            )}
            {site.tech.length > 0 && (
              <Meta label="Built with">
                {site.tech.join(" · ")}
              </Meta>
            )}
            {site.feeds.length > 0 && (
              <Meta label="Feed">
                <a href={site.feeds[0]} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--text-2)" }}>
                  RSS
                </a>
              </Meta>
            )}
          </div>

          {(related.length > 0 || linkedBy.length > 0) && (
            <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              {related.length > 0 && (
                <Connections label="Links out to" sites={related} onOpen={onOpen} />
              )}
              {linkedBy.length > 0 && (
                <Connections label="Linked to by" sites={linkedBy} onOpen={onOpen} />
              )}
            </div>
          )}

          <div className="flex gap-2 mt-6">
            <a
              href={site.finalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 text-center rounded-lg py-2.5 text-[14px] font-medium"
              style={{ background: "var(--accent)", color: "var(--bg-card)" }}
            >
              Visit site →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
        {label}
      </div>
      <div className="mt-0.5" style={{ color: "var(--text-2)" }}>
        {children}
      </div>
    </div>
  );
}

function Connections({ label, sites, onOpen }: { label: string; sites: Site[]; onOpen: (s: Site) => void }) {
  return (
    <div className="mb-2">
      <span className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5 mt-1.5">
        {sites.map((s) => (
          <button key={s.id} className="filter-pill" onClick={() => onOpen(s)} style={{ fontSize: 12 }}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
