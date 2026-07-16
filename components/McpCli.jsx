"use client";

import { useState } from "react";
import SiteHeader from "./SiteHeader";

const MCP_URL = "https://source--design.vercel.app/api/mcp";

const MCP_CONFIG = `{
  "mcpServers": {
    "source-design": {
      "url": "${MCP_URL}"
    }
  }
}`;

const TOOLS = [
  ["extract_design", "Extract a live site's design system: DESIGN.md, Tailwind theme, CSS variables, tokens."],
  ["propose_design", "Propose a cleaner system for your own site: components, contrast-checked palette."],
  ["list_ready_designs", "List the pre-extracted design library."],
  ["get_ready_design", "Fetch one pre-extracted design by slug, any of its four files."],
];

const CLIENTS = [
  ["Claude Code", "claude mcp add --transport http source-design " + MCP_URL],
  ["Claude.ai", "Settings → Connectors → Add custom connector → paste the MCP URL"],
  ["Cursor", "Settings → MCP → Add new server → paste the JSON config"],
  ["Codex / others", "Any MCP client that speaks streamable HTTP works with the URL"],
];

function CopyBlock({ label, text }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-fog">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="press font-mono text-[11px] uppercase tracking-[0.14em] text-cyan"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="mt-2 p-4 bg-surface border border-line overflow-auto font-mono text-xs leading-relaxed text-snow/80">
{text}
      </pre>
    </div>
  );
}

export default function McpCli() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <SiteHeader current="mcp" />
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-5 md:px-10 pb-28">
        <div className="pt-10 md:pt-16 pb-10">
          <h1 className="text-[clamp(2.6rem,6vw,5.5rem)] font-light leading-[0.95] tracking-tight text-snow">
            Also an MCP server.
          </h1>
          <p className="mt-5 text-base leading-[1.39] text-fog max-w-[52ch]">
            Every tool on this site is callable from Claude, ChatGPT, Cursor, or any
            MCP client. Extract design systems directly from your prompts.
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-10 border-t border-line py-12">
          <div className="md:col-span-5">
            <h2 className="text-[clamp(1.4rem,2.6vw,2rem)] font-light text-snow">Connect</h2>
            <p className="mt-3 text-sm leading-relaxed text-fog max-w-[46ch]">
              One URL, streamable HTTP, no auth. Add it to your client and the tools
              show up in the next conversation.
            </p>
          </div>
          <div className="md:col-span-6 md:col-start-7 space-y-6">
            <CopyBlock label="MCP URL" text={MCP_URL} />
            <CopyBlock label="JSON config" text={MCP_CONFIG} />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-10 border-t border-line py-12">
          <div className="md:col-span-5">
            <h2 className="text-[clamp(1.4rem,2.6vw,2rem)] font-light text-snow">Tools</h2>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            {TOOLS.map(([name, note]) => (
              <div key={name} className="py-4 border-t border-line first:border-t-0 md:first:border-t">
                <p className="font-mono text-sm text-cyan">{name}</p>
                <p className="mt-1 text-sm leading-relaxed text-fog">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-10 border-t border-line py-12">
          <div className="md:col-span-5">
            <h2 className="text-[clamp(1.4rem,2.6vw,2rem)] font-light text-snow">Per client</h2>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            {CLIENTS.map(([client, how]) => (
              <div key={client} className="py-4 border-t border-line first:border-t-0 md:first:border-t">
                <p className="text-sm text-snow">{client}</p>
                <p className="mt-1 font-mono text-xs leading-relaxed text-fog break-all">{how}</p>
              </div>
            ))}
          </div>
        </section>
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
