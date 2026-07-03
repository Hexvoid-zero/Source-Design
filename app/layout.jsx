import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-grotesk",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono-jb",
});

const SITE = "https://source--design.vercel.app";

export const metadata = {
  metadataBase: new URL(SITE),
  title: "Source Design — Extract any website's design system",
  description:
    "Paste a URL and get a downloadable DESIGN.md, Tailwind v4 theme, CSS variables, and W3C design tokens extracted from any website's live CSS.",
  keywords: [
    "design tokens", "design system extractor", "tailwind v4 theme",
    "css variables", "DESIGN.md", "design system generator",
  ],
  openGraph: {
    title: "Source Design — Extract any website's design system",
    description:
      "Paste a URL. Get DESIGN.md, a Tailwind v4 theme, CSS variables, and W3C design tokens.",
    url: SITE,
    siteName: "Source Design",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Source Design — Extract any website's design system",
    description:
      "Paste a URL. Get DESIGN.md, a Tailwind v4 theme, CSS variables, and W3C design tokens.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#0a0a0b",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Source Design",
  url: SITE,
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Extracts a design system (DESIGN.md, Tailwind v4 theme, CSS variables, W3C design tokens) from any website URL.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${grotesk.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
