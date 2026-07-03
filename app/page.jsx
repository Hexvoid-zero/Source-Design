"use client";

import { useState } from "react";
import SiteHeader from "../components/SiteHeader";
import DesignViewer from "../components/DesignViewer";
import ready from "../lib/ready/index.json";

const LOGO_MAPPING = {
  chatgpt: "chatgpt.png",
  vercel: "vercel.png",
  supabase: "supabase.png",
  perplexity: "perplexity.png",
  huggingface: "huggingface.png",
  midjourney: "midjourney.png",
  characterai: "characterai.png",
  github: "github.png",
  netlify: "netlify.png",
  cloudflare: "cloudflare.png",
  docker: "docker.png",
  postman: "postman.png",
  canva: "canva.png",
  dropbox: "dropbox.png",
  loom: "loom.png",
  duolingo: "duolingo.png",
  porsche: "porsche.png",
  rolex: "rolex.png",
  sonos: "sonos.png",
  xbox: "xbox.png",
  twitch: "twitch.png",
  netflix: "netflix.png",
};

const FILES = ["DESIGN.md", "tailwind.css", "variables.css", "tokens.json"];

const FILE_NOTES = {
  "DESIGN.md": "A readable design doc: palette, type, spacing, radii, shadows, breakpoints.",
  "tailwind.css": "A Tailwind v4 @theme block. Drop it into a project, tokens become utilities.",
  "variables.css": "Plain :root custom properties. Works with any framework or none.",
  "tokens.json": "W3C Design Tokens format, for Figma plugins and Style Dictionary.",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  async function extract(e) {
    e.preventDefault();
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed.");
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col overflow-x-clip">
      <SiteHeader current="home" />

      <main className="flex-1 w-full">
        {/* hero: monumental whisper-weight statement, left-aligned */}
        <section className="relative max-w-[1400px] mx-auto px-5 md:px-10 pt-14 md:pt-24 pb-16">
          <div
            aria-hidden="true"
            className="mercury-field absolute -top-16 right-[-10%] w-[55vw] h-[40vh] max-w-[720px]"
          />
          <h1 className="relative font-light leading-[0.92] tracking-tight text-snow text-[clamp(3.4rem,11vw,10.5rem)]">
            Design,
            <br />
            extracted.
          </h1>

          <div className="relative mt-12 md:mt-20 md:ml-[38%] max-w-xl">
            <p className="text-lg leading-[1.36] text-fog">
              Paste a URL. Get the site's colors, type, spacing, and shadows back as
              four files you can actually use.
            </p>

            <form onSubmit={extract} className="mt-8 flex flex-col sm:flex-row gap-3">
              <label htmlFor="url" className="sr-only">Website URL</label>
              <input
                id="url"
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck="false"
                placeholder="stripe.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 h-12 px-4 rounded-none bg-surface border border-line text-snow font-mono text-sm placeholder:text-fog/60 outline-none focus:border-cyan transition-colors"
              />
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="press h-12 px-8 rounded-[75px] bg-cyan text-void text-sm font-medium tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? "Extracting…" : "Extract"}
              </button>
            </form>

            {error && (
              <p role="alert" className="reveal mt-4 text-sm text-fog">
                <span className="text-snow">Couldn't extract.</span> {error}
              </p>
            )}
          </div>
        </section>

        {loading && (
          <section aria-hidden="true" className="max-w-[1400px] mx-auto px-5 md:px-10 pb-24 space-y-3 md:ml-[calc(38%)] md:max-w-xl">
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
          <>
            {/* index of artifacts: asymmetric split, hairline rows */}
            <section className="border-t border-line">
              <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-20 md:py-28 grid grid-cols-1 md:grid-cols-12 gap-10">
                <div className="md:col-span-5">
                  <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-light leading-[1.15] text-snow">
                    Four files, mined from the site's real CSS.
                  </h2>
                  <p className="mt-5 text-base leading-[1.39] text-fog max-w-[46ch]">
                    Colors, type scale, spacing, radii, shadows, and breakpoints come
                    from the page and its stylesheets, ranked by how often they appear.
                    Not a screenshot guess.
                  </p>
                </div>
                <div className="md:col-span-6 md:col-start-7">
                  {FILES.map((f) => (
                    <div key={f} className="py-5 border-t border-line first:border-t-0 md:first:border-t">
                      <p className="font-mono text-lg text-snow">{f}</p>
                      <p className="mt-1 text-sm leading-relaxed text-fog">{FILE_NOTES[f]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ready designs teaser: full-width strip, different rhythm */}
            <section className="border-t border-line">
              <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-16 md:py-20">
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-3">
                  <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-light text-snow">
                    Or skip the wait.
                  </h2>
                  <a href="/designs" className="font-mono text-[11px] uppercase tracking-[0.14em]">
                    Browse {ready.length} ready designs
                  </a>
                </div>
                <div className="mt-8 flex flex-wrap gap-x-7 gap-y-4">
                  {ready.slice(0, 12).map((d) => (
                    <a
                      key={d.slug}
                      href={`/designs/${d.slug}`}
                      className="group flex items-center gap-2.5 text-snow hover:no-underline"
                    >
                      {LOGO_MAPPING[d.slug] ? (
                        <div className="w-6 h-6 flex shrink-0 items-center justify-center bg-transparent">
                          <img
                            src={`/sites/${LOGO_MAPPING[d.slug]}`}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <span className="flex">
                          {d.chips.slice(0, 3).map((hex, i) => (
                            <span
                              key={i}
                              className="w-3.5 h-3.5 border border-line -ml-px first:ml-0"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </span>
                      )}
                      <span className="text-sm group-hover:text-cyan transition-colors">
                        {d.name}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </section>

            {/* MCP strip: connect an AI client directly */}
            <section className="border-t border-line">
              <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-14 md:py-16 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                <div className="md:col-span-5">
                  <h2 className="text-[clamp(1.4rem,2.6vw,2rem)] font-light text-snow">
                    Also an MCP server.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-fog max-w-[46ch]">
                    Every tool on this site — extract, propose, and the ready-designs
                    library — is callable from Claude, Cursor, or any MCP client.
                  </p>
                </div>
                <div className="md:col-span-6 md:col-start-7">
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-fog">MCP URL</p>
                  <p className="mt-1 font-mono text-sm text-cyan break-all select-all">
                    https://source--design.vercel.app/api/mcp
                  </p>
                  <pre className="mt-4 p-4 bg-surface border border-line overflow-auto font-mono text-xs leading-relaxed text-snow/80">
{`{
  "mcpServers": {
    "source-design": {
      "url": "https://source--design.vercel.app/api/mcp"
    }
  }
}`}
                  </pre>
                  <p className="mt-3 font-mono text-[11px] text-fog">
                    tools: extract_design · propose_design · list_ready_designs · get_ready_design
                  </p>
                </div>
              </div>
            </section>

            {/* statement band: right-aligned */}
            <section className="border-t border-line">
              <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-16 md:py-24 text-right">
                <p className="text-[clamp(1.3rem,2.6vw,2rem)] font-light leading-[1.25] text-fog">
                  No sign-up. No storage.
                  <br />
                  <span className="text-snow">The extraction runs, you take the files, nothing is kept.</span>
                </p>
              </div>
            </section>
          </>
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
