"use client";

import type { Site } from "@/lib/types";

export default function SiteCard({ site, onOpen }: { site: Site; onOpen: (s: Site) => void }) {
  const img = site.screenshot || site.ogImage;
  return (
    <button className="card text-left" onClick={() => onOpen(site)} aria-label={`Open ${site.name}`}>
      <div className="shot">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={site.name} loading="lazy" decoding="async" />
        ) : (
          <div className="flex items-center justify-center w-full h-full mono text-3xl" style={{ color: "var(--text-3)" }}>
            {site.name.slice(0, 1)}
          </div>
        )}
      </div>
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          {site.favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.favicon} alt="" width={14} height={14} className="rounded-sm shrink-0" style={{ objectFit: "cover" }} />
          )}
          <span className="font-medium text-[14px] truncate" style={{ color: "var(--text-1)" }}>
            {site.name}
          </span>
          {site.role && (
            <span className="chip ml-auto shrink-0" style={{ fontSize: 10 }}>
              {site.role}
            </span>
          )}
        </div>
        <p className="text-[12.5px] mt-1.5 leading-snug line-clamp-2" style={{ color: "var(--text-2)" }}>
          {site.summary || site.description || "—"}
        </p>
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
          {site.tags.slice(0, 3).map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2.5 text-[11px] mono" style={{ color: "var(--text-3)" }}>
          <span className="truncate">{site.host.replace(/^www\./, "")}</span>
          {site.inDegree > 0 && <span className="shrink-0 ml-2">★ {site.inDegree}</span>}
        </div>
      </div>
    </button>
  );
}
