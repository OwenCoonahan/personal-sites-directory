import { getSites, facets } from "@/lib/sites";
import Directory from "@/components/Directory";

export default function Home() {
  const sites = getSites();
  return <Directory sites={sites} facets={facets(sites)} />;
}
