import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin workspace root: stray lockfiles above this dir make Turbopack watch the
  // entire Grand Library / home dir (80-120 GB RAM, froze the machine). Never remove.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,

  typescript: { ignoreBuildErrors: true },
  // Screenshots are local files; remote favicons + service shots load via plain <img>.
  images: { unoptimized: true },
};

export default nextConfig;
