import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { extractDesign } from "../../../lib/extract";
import { proposeSystem } from "../../../lib/propose";
import index from "../../../lib/ready/index.json";

export const maxDuration = 60;

const FILE_NAMES = ["DESIGN.md", "tailwind.css", "variables.css", "tokens.json"];
const SLUGS = index.map((d) => d.slug);

function loadReady(slug) {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const file = path.join(process.cwd(), "lib", "ready", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const text = (s) => ({ content: [{ type: "text", text: s }] });
const err = (s) => ({ content: [{ type: "text", text: s }], isError: true });

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "extract_design",
      "Extract a design system from any live website URL. Mines the site's real CSS and returns DESIGN.md (with usage rules, inferred semantic roles, starter recipes, dark-mode variants), a Tailwind v4 @theme, :root CSS variables, and W3C design tokens. Pass `file` to fetch a single artifact instead of all four.",
      {
        url: z.string().max(2048).describe("Website URL, e.g. https://stripe.com or stripe.com"),
        file: z.enum(FILE_NAMES).optional().describe("Return only this artifact; omit for all four"),
      },
      async ({ url, file }) => {
        try {
          const result = await extractDesign(url.trim());
          if (file) return text(result.files[file]);
          return text(JSON.stringify({ url: result.url, title: result.title, summary: result.summary, files: result.files }, null, 2));
        } catch (e) {
          return err(`Extraction failed: ${e?.message || "unknown error"}`);
        }
      }
    );

    server.tool(
      "list_ready_designs",
      "List the pre-extracted design systems in the Ready Designs library (ChatGPT, Vercel, Supabase, GitHub, Netflix, Porsche, and more). Returns slug, name, description, theme, palette chips, and primary fonts for each.",
      {},
      async () => text(JSON.stringify(index, null, 2))
    );

    server.tool(
      "get_ready_design",
      `Fetch a pre-extracted design system from the Ready Designs library by slug. Available slugs: ${SLUGS.join(", ")}. Pass \`file\` to fetch a single artifact (recommended — full payloads are large).`,
      {
        slug: z.enum(SLUGS).describe("Design slug, e.g. 'vercel'"),
        file: z.enum(FILE_NAMES).optional().describe("Return only this artifact; omit for all four"),
      },
      async ({ slug, file }) => {
        const data = loadReady(slug);
        if (!data) return err(`No ready design found for '${slug}'.`);
        if (file) return text(data.files[file]);
        return text(JSON.stringify({ slug: data.slug, name: data.name, url: data.url, blurb: data.blurb, extractedAt: data.extractedAt, summary: data.summary, files: data.files }, null, 2));
      }
    );

    server.tool(
      "propose_design",
      "Extract a website's current design and propose an upgraded system: keeps the measured accent/theme/fonts/radius, normalizes neutrals into a contrast-checked 11-step ramp, snaps spacing to a 4px grid, and returns React components (components.jsx), a Tailwind v4 theme, W3C tokens, and a proposal DESIGN.md with kept-vs-normalized rationale. Curated recommendations are labeled as curated.",
      {
        url: z.string().max(2048).describe("Your website URL"),
        file: z.enum(["DESIGN.md", "components.jsx", "tailwind.css", "tokens.json"]).optional().describe("Return only this artifact; omit for all four"),
      },
      async ({ url, file }) => {
        try {
          const extraction = await extractDesign(url.trim());
          const proposal = proposeSystem(extraction);
          if (file) return text(proposal.files[file]);
          return text(JSON.stringify({ url: proposal.url, title: proposal.title, summary: proposal.summary, files: proposal.files }, null, 2));
        } catch (e) {
          return err(`Proposal failed: ${e?.message || "unknown error"}`);
        }
      }
    );
  },
  {
    serverInfo: { name: "source-design", version: "1.0.0" },
  },
  {
    basePath: "/api",
    verboseLogs: false,
    maxDuration: 60,
  }
);

export { handler as GET, handler as POST, handler as DELETE };
