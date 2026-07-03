export default function SiteHeader({ current }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-line/40 bg-void/70 backdrop-blur-md">
      <div className="max-w-[1400px] w-full mx-auto px-5 md:px-10 h-20 flex items-center gap-3">
        <a href="/" className="flex items-center gap-3 hover:no-underline">
          <img src="/logo.png" alt="" className="h-8 w-8" />
          <span className="text-xs font-normal tracking-[0.18em] uppercase text-snow">
            Source Design
          </span>
        </a>
        <nav className="ml-auto flex items-center gap-6">
          {current !== "designs" && (
            <a
              href="https://get-design.vercel.app/designs"
              className="press px-4 py-1.5 rounded-full border border-line bg-white/5 hover:bg-white/10 text-[11px] tracking-[0.14em] uppercase text-snow hover:no-underline hover:border-cyan/50 transition-all"
            >
              Ready designs
            </a>
          )}
          {current === "designs" && (
            <a
              href="/"
              className="press px-4 py-1.5 rounded-full border border-line bg-white/5 hover:bg-white/10 text-[11px] tracking-[0.14em] uppercase text-snow hover:no-underline hover:border-cyan/50 transition-all"
            >
              Extract a site
            </a>
          )}
          <span className="hidden sm:inline text-[11px] tracking-[0.14em] uppercase text-fog">
            design system extractor
          </span>
        </nav>
      </div>
    </header>
  );
}

