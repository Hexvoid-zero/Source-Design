"use client";

import { useState } from "react";

export default function DesignViewer({ data, slug }) {
  const FILES = Object.keys(data.files);
  const [tab, setTab] = useState(FILES[0]);
  const [copied, setCopied] = useState(false);

  function countInstall() {
    if (!slug) return;
    fetch("/api/count", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, kind: "install" }),
    }).catch(() => {});
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.files[tab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      countInstall();
    } catch {}
  }

  function download() {
    const blob = new Blob([data.files[tab]], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = tab;
    a.click();
    URL.revokeObjectURL(a.href);
    countInstall();
  }

  return (
    <div className="border border-line bg-surface">
      <div className="p-5 md:p-7 border-b border-line flex flex-wrap items-baseline gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-snow text-xl font-light truncate max-w-[36ch]">
            {data.title || data.url}
          </p>
          <p className="font-mono text-[11px] text-fog mt-1.5">
            {data.summary.meta ? (
              <>{data.summary.themeGuess} · {data.summary.meta}</>
            ) : (
              <>
                {data.summary.themeGuess} ·{" "}
                <span className="text-cyan">{data.summary.stylesheets}</span> stylesheets ·{" "}
                <span className="text-cyan">{data.summary.nativeVarCount}</span> native variables
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {data.summary.colors.slice(0, 12).map((c) => (
            <span
              key={c.name}
              title={`${c.name} ${c.hex}`}
              className="w-6 h-6 border border-line"
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {data.summary.fonts.length > 0 && (
        <div className="px-5 md:px-7 py-3 border-b border-line font-mono text-[11px] text-fog">
          fonts <span className="text-snow">{data.summary.fonts.join(" · ")}</span>
        </div>
      )}

      <div className="flex items-center gap-4 px-5 md:px-7 pt-5 overflow-x-auto" role="tablist">
        {FILES.map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={tab === f}
            onClick={() => setTab(f)}
            className={`press font-mono text-[11px] uppercase tracking-[0.14em] whitespace-nowrap pb-1 border-b transition-colors ${
              tab === f
                ? "text-cyan border-cyan"
                : "text-fog border-transparent hover:text-snow"
            }`}
          >
            {f}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pb-1">
          <button
            onClick={copy}
            className="press px-5 h-8 rounded-[75px] border border-line text-xs text-snow hover:border-fog transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={download}
            className="press px-5 h-8 rounded-[75px] bg-cyan text-void text-xs font-medium"
          >
            Download
          </button>
        </div>
      </div>

      <pre className="m-5 md:m-7 p-5 bg-void border border-line overflow-auto max-h-[60vh] font-mono text-xs leading-relaxed text-snow/80">
        <code>{data.files[tab]}</code>
      </pre>
    </div>
  );
}
