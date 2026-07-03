import index from "../lib/ready/index.json";

const SITE = "https://get-design.vercel.app";

export default function sitemap() {
  return [
    { url: SITE, lastModified: new Date(), changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/designs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    ...index.map((d) => ({
      url: `${SITE}/designs/${d.slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    })),
  ];
}
