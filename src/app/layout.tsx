import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SITE_URL } from "@/lib/sites";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESC =
  "A growing directory of personal websites from developers, designers, founders, and makers. Browse the corners of the indie web.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Homepages — a directory of personal websites",
    template: "%s · Homepages",
  },
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Homepages — a directory of personal websites",
    description: DESC,
    url: "/",
    siteName: "Homepages",
    type: "website",
    images: ["/mac-hello.png"],
  },
  twitter: { card: "summary_large_image", title: "Homepages", description: DESC, images: ["/mac-hello.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
