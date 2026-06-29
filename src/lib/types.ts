export type Site = {
  id: string;
  url: string;
  host: string;
  finalUrl: string;

  name: string; // display name (person or site)
  title: string; // raw page <title>
  summary: string; // one-line "what this is"
  description: string; // meta description

  screenshot: string | null;
  ogImage: string | null;
  favicon: string | null;

  role: string; // Developer / Designer / Founder / Writer / Artist / Investor / Researcher / Maker
  tags: string[]; // topics & skills (filterable)
  features: string[]; // Blog / Newsletter / Now / Projects / Shop / Portfolio
  tech: string[]; // detected stack

  feeds: string[];
  outbound: string[]; // external hostnames found on the page
  links: string[]; // ids of OTHER sites in the directory this one links to (graph edges)
  inDegree: number; // how many directory sites link TO this one (ranking signal)

  status: string;
};
