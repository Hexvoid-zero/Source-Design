// Pre-extracts design systems for the Ready Designs library.
// Usage:
//   node scripts/build-ready.mjs             -> extract all missing
//   node scripts/build-ready.mjs vercel      -> extract one slug
//   node scripts/build-ready.mjs --from-html <slug> <htmlFile> <url>  -> ingest stealth-fetched HTML
import fs from "node:fs";
import path from "node:path";
import { extractDesign, extractFromHtml, regenerateFromRaw } from "../lib/extract.js";

const OUT = path.join(process.cwd(), "lib", "ready");

export const SITES = [
  { slug: "chatgpt", name: "ChatGPT", url: "https://chatgpt.com", blurb: "AI assistant. Quiet gray canvas, conversation-first restraint, almost no chrome." },
  { slug: "vercel", name: "Vercel", url: "https://vercel.com", blurb: "Deployment platform. Monochrome discipline, Geist everywhere, hairline geometry." },
  { slug: "supabase", name: "Supabase", url: "https://supabase.com", blurb: "Postgres platform. Dark developer canvas with a single jade-green accent." },
  { slug: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai", blurb: "Answer engine. Deep teal surfaces, serif-touched type, search-box gravity." },
  { slug: "huggingface", name: "Hugging Face", url: "https://huggingface.co", blurb: "ML hub. Warm yellow mascot accent over utilitarian data-dense lists." },
  { slug: "midjourney", name: "Midjourney", url: "https://www.midjourney.com", blurb: "Image generation. Near-black gallery walls that let renders carry all color." },
  { slug: "characterai", name: "Character.ai", url: "https://character.ai", blurb: "AI characters. Soft rounded chat UI, friendly neutrals, avatar-led rows." },
  { slug: "github", name: "GitHub", url: "https://github.com", blurb: "Code hosting. Primer system: dense neutrals, small type, precise borders." },
  { slug: "netlify", name: "Netlify", url: "https://www.netlify.com", blurb: "Web platform. Teal-to-blue brand accents on clean white developer marketing." },
  { slug: "cloudflare", name: "Cloudflare", url: "https://www.cloudflare.com", blurb: "Edge network. Orange brand anchor, enterprise blues, diagram-heavy sections." },
  { slug: "docker", name: "Docker", url: "https://www.docker.com", blurb: "Containers. Signature blue, whale-scale product marketing, boxy cards." },
  { slug: "postman", name: "Postman", url: "https://www.postman.com", blurb: "API platform. Orange on charcoal, workspace UI screenshots front and center." },
  { slug: "canva", name: "Canva", url: "https://www.canva.com", blurb: "Design tool. Cyan-violet brand wash, rounded everything, template-grid energy." },
  { slug: "dropbox", name: "Dropbox", url: "https://www.dropbox.com", blurb: "File storage. Flat blue on white, generous space, illustration-driven calm." },
  { slug: "loom", name: "Loom", url: "https://www.loom.com", blurb: "Video messaging. Purple-red gradient accents, soft cards, recorder-first CTAs." },
  { slug: "duolingo", name: "Duolingo", url: "https://www.duolingo.com", blurb: "Language learning. Feather green, chunky rounded buttons, cartoon confidence." },
  { slug: "porsche", name: "Porsche", url: "https://www.porsche.com", blurb: "Sports cars. Black-and-white showroom, full-bleed photography, thin utility type." },
  { slug: "rolex", name: "Rolex", url: "https://www.rolex.com", blurb: "Watchmaking. Deep green heritage, gold restraint, serif authority, slow pacing." },
  { slug: "sonos", name: "Sonos", url: "https://www.sonos.com", blurb: "Home audio. Matte monochrome, product photography on tonal fields, quiet type." },
  { slug: "xbox", name: "Xbox", url: "https://www.xbox.com", blurb: "Gaming. Signature green on carbon, tile grids, hero art from current releases." },
  { slug: "twitch", name: "Twitch", url: "https://www.twitch.tv", blurb: "Live streaming. Full-commit purple, dark viewer chrome, thumbnail-dense grids." },
  { slug: "netflix", name: "Netflix", url: "https://www.netflix.com", blurb: "Streaming. Red-on-black cinema chrome, poster art as the entire layout." },
];

function save(site, result) {
  fs.mkdirSync(OUT, { recursive: true });
  const record = {
    slug: site.slug,
    name: site.name,
    blurb: site.blurb,
    url: result.url,
    title: result.title,
    extractedAt: new Date().toISOString().slice(0, 10),
    summary: result.summary,
    files: result.files,
    raw: result.raw, // mined tokens, kept so files can be regenerated offline
  };
  fs.writeFileSync(path.join(OUT, `${site.slug}.json`), JSON.stringify(record, null, 1));
  console.log(`OK   ${site.slug}  colors=${result.summary.colors.length} fonts=${result.summary.fonts.length} vars=${result.summary.nativeVarCount}`);
}

function rebuildIndex() {
  const entries = [];
  for (const site of SITES) {
    const f = path.join(OUT, `${site.slug}.json`);
    if (!fs.existsSync(f)) continue;
    const r = JSON.parse(fs.readFileSync(f, "utf8"));
    entries.push({
      slug: r.slug,
      name: r.name,
      blurb: r.blurb,
      url: r.url,
      extractedAt: r.extractedAt,
      theme: r.summary.themeGuess,
      chips: r.summary.colors.slice(0, 5).map((c) => c.hex),
      fonts: r.summary.fonts.slice(0, 2),
      tokenCount: r.summary.colors.length + r.summary.nativeVarCount,
    });
  }
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(entries, null, 1));
  console.log(`index.json: ${entries.length} designs`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--from-html") {
    const [, slug, htmlFile, url] = args;
    const site = SITES.find((s) => s.slug === slug);
    if (!site) throw new Error(`unknown slug ${slug}`);
    const html = fs.readFileSync(htmlFile, "utf8");
    const result = await extractFromHtml(html, url || site.url);
    save(site, result);
    rebuildIndex();
    return;
  }

  if (args[0] === "--index") {
    rebuildIndex();
    return;
  }

  // Rebuild all four artifacts from stored raw tokens — no network.
  if (args[0] === "--regen") {
    for (const site of SITES) {
      const f = path.join(OUT, `${site.slug}.json`);
      if (!fs.existsSync(f)) continue;
      const rec = JSON.parse(fs.readFileSync(f, "utf8"));
      if (!rec.raw) {
        console.log(`skip ${site.slug} (no raw tokens stored — re-extract instead)`);
        continue;
      }
      save(site, regenerateFromRaw(rec.raw, rec.url));
    }
    rebuildIndex();
    return;
  }

  const only = args[0];
  const targets = only ? SITES.filter((s) => s.slug === only) : SITES;
  const failed = [];
  for (const site of targets) {
    const outFile = path.join(OUT, `${site.slug}.json`);
    if (!only && fs.existsSync(outFile)) {
      console.log(`skip ${site.slug} (exists)`);
      continue;
    }
    try {
      const result = await extractDesign(site.url);
      save(site, result);
    } catch (e) {
      failed.push(site.slug);
      console.log(`FAIL ${site.slug}  ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  rebuildIndex();
  if (failed.length) console.log(`\nfailed: ${failed.join(", ")}`);
}

main();
