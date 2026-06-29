import { getSites, facets } from "@/lib/sites";
import Directory from "@/components/Directory";

// Read at request time so newly-approved sites appear immediately.
export const dynamic = "force-dynamic";

export default async function Home() {
  const sites = await getSites();
  return <Directory sites={sites} facets={facets(sites)} />;
}
