import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getSites, getSiteById, relatedSites, SITE_URL } from "@/lib/sites";
import Favicon from "@/components/Favicon";

export const dynamicParams = false;

export function generateStaticParams() {
  return getSites().map((s) => ({ slug: s.id }));
}

function descOf(site: NonNullable<ReturnType<typeof getSiteById>>) {
  return site.summary || site.description || `${site.name}'s personal website.`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const site = getSiteById(slug);
  if (!site) return {};
  const desc = descOf(site);
  const canonical = `/s/${site.id}`;
  const images = site.screenshot ? [SITE_URL + site.screenshot] : [];
  return {
    title: site.name,
    description: desc,
    alternates: { canonical },
    openGraph: { title: `${site.name} — Homepages`, description: desc, url: canonical, images, type: "profile", siteName: "Homepages" },
    twitter: { card: "summary_large_image", title: `${site.name} — Homepages`, description: desc, images },
  };
}

export default async function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = getSiteById(slug);
  if (!site) notFound();

  const host = site.host.replace(/^www\./, "");
  const img = site.screenshot || site.ogImage;
  const desc = descOf(site);
  const related = relatedSites(site);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateModified: undefined,
    mainEntity: {
      "@type": "Person",
      name: site.name,
      url: site.finalUrl,
      ...(site.role ? { jobTitle: site.role } : {}),
      ...(desc ? { description: desc } : {}),
    },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="px-5 md:px-8 pt-8 pb-4 max-w-[860px] mx-auto w-full">
        <Link href="/" className="text-[13px] mono" style={{ color: "var(--text-3)" }}>
          ← Homepages
        </Link>
      </header>

      <main className="px-5 md:px-8 pb-16 max-w-[860px] mx-auto w-full flex-1">
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <div className="shot" style={{ aspectRatio: "16 / 10" }}>
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt={`Screenshot of ${site.name}'s website`} />
            ) : (
              <div className="flex items-center justify-center w-full h-full mono text-5xl" style={{ color: "var(--text-3)" }}>
                {site.name.slice(0, 1)}
              </div>
            )}
          </div>

          <div className="p-5 md:p-7">
            <div className="flex items-center gap-3">
              <Favicon site={site} size={30} />
              <div className="min-w-0">
                <h1 className="text-[24px] font-semibold leading-tight" style={{ color: "var(--text-1)" }}>
                  {site.name}
                </h1>
                <a href={site.finalUrl} target="_blank" rel="noopener" referrerPolicy="origin" className="host-link text-[13px] mono">
                  {host} ↗
                </a>
              </div>
            </div>

            <p className="text-[15px] mt-4 leading-relaxed" style={{ color: "var(--text-2)" }}>
              {desc}
            </p>

            {(site.role || site.tags.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {site.role && <span className="chip" style={{ background: "var(--accent)", color: "var(--bg-card)" }}>{site.role}</span>}
                {site.tags.map((t) => (
                  <span key={t} className="chip">{t}</span>
                ))}
              </div>
            )}

            {(site.tech.length > 0 || site.features.length > 0) && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-5 text-[12.5px]">
                {site.features.length > 0 && (
                  <div>
                    <div className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Has</div>
                    <div className="mt-0.5" style={{ color: "var(--text-2)" }}>{site.features.join(" · ")}</div>
                  </div>
                )}
                {site.tech.length > 0 && (
                  <div>
                    <div className="mono text-[10.5px] uppercase tracking-wide" style={{ color: "var(--text-3)" }}>Built with</div>
                    <div className="mt-0.5" style={{ color: "var(--text-2)" }}>{site.tech.join(" · ")}</div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <a
                href={site.finalUrl}
                target="_blank"
                rel="noopener"
                referrerPolicy="origin"
                className="inline-block rounded-lg px-5 py-2.5 text-[14px] font-medium"
                style={{ background: "var(--accent)", color: "var(--bg-card)" }}
              >
                Visit {host} →
              </a>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[13px] mono uppercase tracking-wide mb-3" style={{ color: "var(--text-3)" }}>
              Connected sites
            </h2>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              {related.slice(0, 12).map((r) => (
                <Link
                  key={r.id}
                  href={`/s/${r.id}`}
                  className="flex items-center gap-2.5 rounded-lg p-3"
                  style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
                >
                  <Favicon site={r} size={18} />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-medium truncate" style={{ color: "var(--text-1)" }}>{r.name}</span>
                    <span className="block text-[11px] mono truncate" style={{ color: "var(--text-3)" }}>{r.host.replace(/^www\./, "")}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="mt-12 text-[13px]" style={{ color: "var(--text-3)" }}>
          Listed on <Link href="/" className="host-link">Homepages</Link>, a directory of personal websites.
        </p>
      </main>
    </div>
  );
}
