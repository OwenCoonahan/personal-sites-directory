import type { MetadataRoute } from "next";
import { getSites, SITE_URL } from "@/lib/sites";

export default function sitemap(): MetadataRoute.Sitemap {
  const sites = getSites();
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...sites.map((s) => ({
      url: `${SITE_URL}/s/${s.id}`,
      changeFrequency: "monthly" as const,
      priority: s.notable ? 0.8 : 0.6,
    })),
  ];
}
