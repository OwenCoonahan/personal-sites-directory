"use client";

import { useState } from "react";
import type { Site } from "@/lib/types";

function initials(name: string): string {
  const words = name.trim().split(/[\s.]+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Shows the site's favicon; if it's missing or fails to load, falls back to a
// clean circle with the person's initials (never a broken-image glyph).
export default function Favicon({ site, size = 16, className = "" }: { site: Site; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (site.favicon && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={site.favicon}
        alt=""
        width={size}
        height={size}
        className={`rounded-sm shrink-0 ${className}`}
        style={{ objectFit: "cover" }}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`shrink-0 inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background: "var(--chip)",
        color: "var(--text-2)",
        fontSize: Math.round(size * 0.48),
        fontWeight: 600,
        lineHeight: 1,
        letterSpacing: "-0.02em",
      }}
    >
      {initials(site.name)}
    </span>
  );
}
