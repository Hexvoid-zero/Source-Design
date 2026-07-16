"use client";

import { useState } from "react";
import SiteHeader from "./SiteHeader";
import DesignViewer from "./DesignViewer";

export default function YourWebsite() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function propose(e) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Proposal failed.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-clip">
      <SiteHeader current="your-website" />

      <main className="flex-1 w-full">
        <section className="relative max-w-[1400px] mx-auto px-5 md:px-10 pt-14 md:pt-20 pb-14">
          <h1 className="font-light leading-[0.95] tracking-tight text-snow text-[clamp(2.8rem,8vw,7.5rem)]">
            Your website,
            <br />
            upgraded.
          </h1>

          <div className="mt-10 md:mt-16 md:ml-[38%] max-w-xl">
            <p className="text-lg leading-[1.36] text-fog">
              Paste your site. We extract what you have, keep what works, and
              propose a cleaner system: React components, a contrast-checked
              palette, type, and spacing.
            </p>

            <form onSubmit={propose} className="mt-8 flex flex-col sm:flex-row gap-3">
              <label htmlFor="url" className="sr-only">Your website URL</label>
              <input
                id="url"
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck="false"
                placeholder="yoursite.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 h-12 px-4 rounded-none bg-surface border border-line text-snow font-mono text-sm placeholder:text-fog/60 outline-none focus:border-cyan transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="press h-12 px-8 rounded-[75px] bg-cyan text-void text-sm font-medium tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Proposing…" : "Propose"}
              </button>
            </form>

            {error && (
              <p role="alert" className="reveal mt-4 text-sm text-fog">
                <span className="text-snow">Couldn't build a proposal.</span> {error}
              </p>
            )}
          </div>
        </section>

        {loading && (
          <section aria-hidden="true" className="max-w-[1400px] mx-auto px-5 md:px-10 pb-24 space-y-3 md:ml-[38%] md:max-w-xl">
            <div className="skeleton h-10" />
            <div className="skeleton h-64" />
          </section>
        )}

        {result && !loading && (
          <section className="reveal max-w-[1400px] mx-auto px-5 md:px-10 pb-28">
            <DesignViewer data={result} slug={null} />
          </section>
        )}

        {!result && !loading && (
          <section className="border-t border-line">
            <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-10">
              <div className="md:col-span-5">
                <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-light leading-[1.15] text-snow">
                  Kept, normalized, labeled.
                </h2>
              </div>
              <div className="md:col-span-6 md:col-start-7 space-y-6">
                <div>
                  <p className="font-mono text-sm text-snow">Kept from your site</p>
                  <p className="mt-1 text-sm leading-relaxed text-fog">
                    Your accent color, theme, confident fonts, most-used radius, and
                    type sizes — everything the extraction can prove is deliberate.
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm text-snow">Normalized</p>
                  <p className="mt-1 text-sm leading-relaxed text-fog">
                    Neutrals become an 11-step ramp built from your canvas undertone;
                    muted text is picked by computed WCAG contrast; spacing snaps to a
                    4px grid.
                  </p>
                </div>
                <div>
                  <p className="font-mono text-sm text-snow">Labeled recommendations</p>
                  <p className="mt-1 text-sm leading-relaxed text-fog">
                    Anything not derived from your CSS (font pairings, component
                    scaffolding) comes from component-library conventions and says so
                    in the output. You get components.jsx, tailwind.css, tokens.json,
                    and a new DESIGN.md.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
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
