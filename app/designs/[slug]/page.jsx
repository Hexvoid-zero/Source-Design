import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import DesignViewer from "../../../components/DesignViewer";
import BookmarkButton from "../../../components/BookmarkButton";
import index from "../../../lib/ready/index.json";

export function generateStaticParams() {
  return index.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }) {
  const meta = index.find((d) => d.slug === params.slug);
  if (!meta) return {};
  return {
    title: `${meta.name} design system — DESIGN.md, Tailwind v4 theme, design tokens`,
    description: `${meta.blurb} Extracted from ${meta.url}: DESIGN.md, Tailwind v4 @theme, CSS variables, and W3C tokens.json, ready to copy or download.`,
  };
}

function load(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(process.cwd(), "lib", "ready", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export default function DesignPage({ params }) {
  const data = load(params.slug);
  if (!data) notFound();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <SiteHeader current="designs" />
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 md:px-10 pb-28">
        <div className="pt-8 md:pt-12 pb-10">
          <a href="/designs" className="font-mono text-[11px] uppercase tracking-[0.14em]">
            All designs
          </a>
          <div className="mt-6 flex flex-wrap items-end gap-x-8 gap-y-5">
            <h1 className="text-[clamp(2.4rem,5.5vw,5rem)] font-light leading-[0.95] tracking-tight text-snow">
              {data.name}
            </h1>
            <div className="pb-2">
              <BookmarkButton slug={data.slug} />
            </div>
          </div>
          <p className="mt-4 text-base leading-[1.39] text-fog max-w-[60ch]">{data.blurb}</p>
          <p className="mt-2 font-mono text-[11px] text-fog">
            extracted from <a href={data.url} rel="noopener nofollow">{data.url}</a> on{" "}
            {data.extractedAt}
          </p>
        </div>
        <DesignViewer
          data={{ title: data.title, url: data.url, summary: data.summary, files: data.files }}
          slug={data.slug}
        />
      </main>
      <footer className="border-t border-line">
        <div className="max-w-[1400px] mx-auto px-5 md:px-10 h-14 flex items-center justify-between text-[11px] tracking-[0.14em] uppercase text-fog">
          <span>Source Design</span>
          <span>part of the Source suite</span>
        </div>
      </footer>
    </div>
  );
}
