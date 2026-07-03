"use client";

import { useEffect, useState } from "react";

function fmt(n) {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

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

export default function DesignsList({ designs }) {
  const [q, setQ] = useState("");
  const [counts, setCounts] = useState({});

  useEffect(() => {
    fetch("/api/count")
      .then((r) => r.json())
      .then((rows) => {
        const map = {};
        for (const r of rows) map[r.slug] = r;
        setCounts(map);
      })
      .catch(() => {});
  }, []);

  const shown = designs.filter(
    (d) =>
      !q.trim() ||
      d.name.toLowerCase().includes(q.trim().toLowerCase()) ||
      d.blurb.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter designs"
        aria-label="Filter designs"
        className="w-full sm:w-80 h-11 px-4 rounded-none bg-surface border border-line text-snow font-mono text-sm placeholder:text-fog/60 outline-none focus:border-cyan transition-colors"
      />

      <div className="mt-8 hidden md:grid grid-cols-12 gap-4 pb-3 text-[10px] font-mono uppercase tracking-[0.18em] text-fog">
        <span className="col-span-5">Design</span>
        <span className="col-span-4">Palette · type</span>
        <span className="col-span-2 text-right">Installs</span>
        <span className="col-span-1 text-right">Saved</span>
      </div>

      {shown.map((d) => (
        <a
          key={d.slug}
          href={`/designs/${d.slug}`}
          className="group grid grid-cols-12 gap-4 items-center py-5 border-t border-line text-inherit hover:no-underline hover:bg-surface transition-colors md:px-3 md:-mx-3"
        >
          <div className="col-span-12 md:col-span-5 flex items-center gap-4 min-w-0">
            {LOGO_MAPPING[d.slug] ? (
              <div className="w-10 h-10 flex shrink-0 items-center justify-center bg-transparent">
                <img
                  src={`/sites/${LOGO_MAPPING[d.slug]}`}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <span className="flex shrink-0">
                {d.chips.map((hex, i) => (
                  <span
                    key={i}
                    className="w-5 h-5 border border-line -ml-px first:ml-0"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-snow group-hover:text-cyan transition-colors">
                {d.name}
              </span>
              <span className="block text-sm text-fog truncate">{d.blurb}</span>
            </span>
          </div>
          <div className="col-span-8 md:col-span-4 font-mono text-[11px] text-fog truncate">
            {d.theme}
            {d.fonts.length > 0 && <> · {d.fonts.join(", ")}</>}
          </div>
          <div className="col-span-2 md:col-span-2 font-mono text-sm text-right text-cyan">
            {fmt(counts[d.slug]?.installs)}
          </div>
          <div className="col-span-2 md:col-span-1 font-mono text-sm text-right text-cyan">
            {fmt(counts[d.slug]?.bookmarks)}
          </div>
        </a>
      ))}

      {shown.length === 0 && (
        <p className="py-10 border-t border-line text-fog text-sm">
          Nothing matches "{q}".
        </p>
      )}
    </div>
  );
}
