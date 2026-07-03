import SiteHeader from "../../components/SiteHeader";
import DesignsList from "../../components/DesignsList";
import index from "../../lib/ready/index.json";

export const metadata = {
  title: "Ready designs — 22 real design systems, extracted",
  description:
    "Pre-extracted DESIGN.md, Tailwind v4 themes, CSS variables, and W3C design tokens for ChatGPT, Vercel, Supabase, GitHub, Netflix, Porsche, and more.",
};

export default function DesignsPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <SiteHeader current="designs" />
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 md:px-10 pb-28">
        <div className="pt-10 md:pt-16 pb-10 md:flex md:items-end md:justify-between gap-10">
          <div>
            <h1 className="text-[clamp(2.6rem,6vw,5.5rem)] font-light leading-[0.95] tracking-tight text-snow">
              Ready designs
            </h1>
            <p className="mt-5 text-base leading-[1.39] text-fog max-w-[52ch]">
              {index.length} design systems already extracted with the same engine.
              Each one is the site's real CSS, four files, copy or download.
            </p>
          </div>
          <p className="hidden md:block font-mono text-[11px] text-fog whitespace-nowrap pb-2">
            <span className="text-cyan">{index.length}</span> designs · install and
            bookmark counts are live
          </p>
        </div>
        <DesignsList designs={index} />
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
