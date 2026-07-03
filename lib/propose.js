// "Your Website" proposal engine.
// Takes a real extraction of the user's site and proposes an upgraded system:
// - keeps what the data says is theirs (accent, theme, confident fonts, radius)
// - normalizes what's messy (neutral ramp, spacing grid, contrast pairs)
// - binds generic React components to the proposed tokens
// Recommendations that are not derived from their CSS come from a small
// curated set (component-library ecosystem conventions) and are labeled as such.

import {
  luminance, contrast, hslOf, hslToRgb, hexFromRgb,
  classifyFonts, fontConfidence,
} from "./extract.js";

// curated from the component-library ecosystem (Vercel/Geist, shadcn/ui
// defaults, Google Fonts pairings) — not extracted, and labeled as curated
const PAIRINGS = [
  { id: "geist", sans: "Geist", mono: "Geist Mono", vibe: "clean product UI", when: "light" },
  { id: "space", sans: "Space Grotesk", mono: "JetBrains Mono", vibe: "technical, dark-leaning", when: "dark" },
  { id: "instrument", sans: "Instrument Sans", mono: "IBM Plex Mono", vibe: "friendly SaaS", when: "light" },
  { id: "schibsted", sans: "Schibsted Grotesk", mono: "Fira Code", vibe: "editorial product", when: "dark" },
];

const RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const RAMP_L = [0.98, 0.955, 0.91, 0.82, 0.7, 0.55, 0.42, 0.32, 0.22, 0.14, 0.09];

function hexAt(h, s, l) {
  const [r, g, b] = hslToRgb(h, s * 100, l * 100);
  return hexFromRgb(r, g, b);
}

export function proposeSystem(extraction) {
  const t = extraction.raw.tokens;
  const dark = t.themeGuess === "dark-leaning";

  // --- neutral ramp: derived from THEIR canvas hue, normalized lightness ---
  const minedNeutrals = t.neutrals.map((n) => n.hex);
  const canvasSrc = dark
    ? minedNeutrals[minedNeutrals.length - 1] || "#0a0a0a"
    : minedNeutrals[0] || "#ffffff";
  const [ch, cs] = hslOf(canvasSrc);
  const tint = Math.min(cs, 0.06); // keep their undertone, stay neutral
  const ramp = RAMP_STEPS.map((step, i) => ({
    name: `neutral-${step}`,
    hex: hexAt(ch, tint, RAMP_L[i]),
  }));

  // --- semantic assignments with contrast checks ---
  const pick = (step) => ramp.find((r) => r.name === `neutral-${step}`);
  const canvas = dark ? pick(950) : pick(50);
  const surface = dark ? pick(900) : pick(100);
  const line = dark ? pick(800) : pick(200);
  const ink = dark ? pick(50) : pick(950);
  // muted: walk toward ink until AA (4.5:1) against canvas
  const mutedOrder = dark ? [400, 300, 200, 100] : [600, 700, 800, 900];
  let muted = null;
  for (const s of mutedOrder) {
    const c = pick(s);
    if (contrast(c.hex, canvas.hex) >= 4.5) { muted = c; break; }
  }
  muted = muted || (dark ? pick(300) : pick(700));

  // --- accent: theirs, kept ---
  const minedAccent = t.accents[0] || null;
  const accent = minedAccent ? minedAccent.hex : null;
  const accentInk = accent
    ? (contrast("#ffffff", accent) >= contrast(ink.hex, accent) ? "#ffffff" : ink.hex)
    : null;
  const accentContrast = accent ? contrast(accentInk, accent) : null;

  // --- fonts: keep if the data supports it, otherwise curated recommendation ---
  const stacks = classifyFonts(t.fonts);
  const conf = fontConfidence(t.fonts);
  const keepSans = (conf === "high" || conf === "medium") && stacks.sans;
  const pairing = PAIRINGS.find((p) => p.when === (dark ? "dark" : "light"));
  const sans = keepSans ? stacks.sans : pairing.sans;
  const mono = stacks.mono || pairing.mono;
  const fontDecision = keepSans
    ? `kept your ${stacks.sans} (${conf}-confidence in the extraction)`
    : `curated recommendation (${pairing.sans} + ${pairing.mono}, ${pairing.vibe}) — your CSS gave ${conf === "none" ? "no custom families" : "no confident primary"}`;

  // --- spacing: snap mined values to a 4px grid, fill gaps with the standard scale ---
  const snapped = [...new Set(t.spacing.map((px) => Math.max(4, Math.round(px / 4) * 4)))].sort((a, b) => a - b);
  const spacing = snapped.length >= 5 ? snapped.slice(0, 10) : [4, 8, 12, 16, 24, 32, 48, 64];
  const spacingDecision = snapped.length >= 5
    ? `your mined values snapped to the 4px grid (${t.spacing.join(", ")} → ${spacing.join(", ")})`
    : `standard 4px scale — too few spacing values were mined (${t.spacing.join(", ") || "none"}) to preserve a scale`;

  // --- radius: their dominant value as the base of a coherent scale ---
  const finite = t.radii.filter((r) => !/9999|50%/.test(r.value));
  const domRadius = [...finite].sort((a, b) => b.count - a.count)[0];
  const basePx = domRadius
    ? Math.max(2, Math.round(parseFloat(domRadius.value) * (domRadius.value.includes("rem") ? 16 : 1)))
    : 8;
  const radius = { sm: Math.max(2, Math.round(basePx / 2)), md: basePx, lg: basePx * 2, full: 9999 };
  const radiusDecision = domRadius
    ? `built around your most-used radius (${domRadius.value}, x${domRadius.count})`
    : `8px base — no usable radius was mined`;

  // --- type scale: keep mined sizes when there are enough of them ---
  const sizes = t.fontSizes.length >= 5 ? t.fontSizes : [12, 14, 16, 18, 20, 24, 30, 36, 48, 60];
  const sizesKept = t.fontSizes.length >= 5;

  const p = {
    dark, ramp, canvas, surface, line, ink, muted,
    accent, accentInk, accentContrast, minedAccent,
    sans, mono, keepSans, fontDecision, conf, pairing,
    spacing, spacingDecision, radius, radiusDecision,
    sizes, sizesKept,
    url: extraction.url, title: extraction.title,
  };

  return {
    url: extraction.url,
    title: extraction.title,
    summary: {
      themeGuess: `proposed ${dark ? "dark" : "light"} system`,
      meta: `${accent ? `accent ${accent} kept` : "achromatic"} · ${sans} · ${spacing.length}-step spacing · radius ${basePx}px`,
      colors: [
        ...[canvas, surface, line, muted, ink].map((c) => ({ name: c.name, hex: c.hex, group: "neutral" })),
        ...(accent ? [{ name: "accent", hex: accent, group: "accent" }] : []),
      ],
      fonts: [sans, mono].filter(Boolean),
      stylesheets: extraction.summary.stylesheets,
      nativeVarCount: extraction.summary.nativeVarCount,
    },
    files: {
      "DESIGN.md": proposalMd(p),
      "components.jsx": componentsJsx(p),
      "tailwind.css": proposalTailwind(p),
      "tokens.json": proposalTokens(p),
    },
  };
}

function proposalMd(p) {
  const L = [];
  L.push("---");
  L.push(`name: ${new URL(p.url).hostname.replace(/^www\./, "").replace(/\./g, "-")}-proposed-system`);
  L.push(`source: ${p.url}`);
  L.push(`generated: ${new Date().toISOString().slice(0, 10)}`);
  L.push(`theme: ${p.dark ? "dark" : "light"}  # measured on your site, kept`);
  L.push(`colors:`);
  L.push(`  canvas: "${p.canvas.hex}"`);
  L.push(`  surface: "${p.surface.hex}"`);
  L.push(`  line: "${p.line.hex}"`);
  L.push(`  text-muted: "${p.muted.hex}"  # ${contrast(p.muted.hex, p.canvas.hex).toFixed(1)}:1 vs canvas`);
  L.push(`  ink: "${p.ink.hex}"  # ${contrast(p.ink.hex, p.canvas.hex).toFixed(1)}:1 vs canvas`);
  if (p.accent) {
    L.push(`  accent: "${p.accent}"  # yours, kept`);
    L.push(`  accent-ink: "${p.accentInk}"  # ${p.accentContrast.toFixed(1)}:1 on accent`);
  }
  L.push(`fonts:`);
  L.push(`  sans: "${p.sans}"${p.keepSans ? "  # yours, kept" : "  # curated recommendation"}`);
  L.push(`  mono: "${p.mono}"`);
  L.push("---");
  L.push("");
  L.push(`# Proposed design system for ${new URL(p.url).hostname.replace(/^www\./, "")}`);
  L.push("");
  L.push(`Generated from a live extraction of **${p.url}**. This is a *proposal*: it keeps what your CSS says is deliberate, normalizes what looks accidental, and labels every recommendation that didn't come from your site.`);
  L.push("");
  L.push(`## What was kept (measured on your site)`);
  L.push("");
  L.push(`- **Theme:** ${p.dark ? "dark" : "light"}, as measured from your neutral usage.`);
  if (p.accent) L.push(`- **Accent:** \`${p.accent}\` — your most-used chromatic color. Text on accent is \`${p.accentInk}\` (computed ${p.accentContrast.toFixed(1)}:1${p.accentContrast < 4.5 ? ", below AA — use for large text and icons only" : ""}).`);
  else L.push(`- **Achromatic palette** — your site exposes no saturated UI color; the proposal stays monochrome rather than inventing a brand color.`);
  L.push(`- **Radius:** ${p.radiusDecision}.`);
  if (p.keepSans) L.push(`- **Typeface:** ${p.fontDecision}.`);
  if (p.sizesKept) L.push(`- **Type sizes:** your mined scale (${p.sizes.join(", ")}px).`);
  L.push("");
  L.push(`## What was normalized`);
  L.push("");
  L.push(`- **Neutrals:** your mined neutrals were replaced with an 11-step ramp generated from your canvas undertone (hue ${Math.round(hslOf(p.canvas.hex)[0])}°), so every light/dark pairing has a predictable contrast.`);
  L.push(`- **Muted text:** \`${p.muted.hex}\` was chosen as the first ramp step that clears WCAG AA (${contrast(p.muted.hex, p.canvas.hex).toFixed(1)}:1) against canvas.`);
  L.push(`- **Spacing:** ${p.spacingDecision}.`);
  if (!p.keepSans) L.push(`- **Typeface:** ${p.fontDecision}. Load via Google Fonts or self-host.`);
  L.push("");
  L.push(`## Palette`);
  L.push("", `| Token | Value | Contrast vs canvas |`, `| --- | --- | --- |`);
  p.ramp.forEach((r) => L.push(`| \`${r.name}\` | \`${r.hex}\` | ${contrast(r.hex, p.canvas.hex).toFixed(1)}:1 |`));
  if (p.accent) L.push(`| \`accent\` | \`${p.accent}\` | ${contrast(p.accent, p.canvas.hex).toFixed(1)}:1 |`);
  L.push("");
  L.push(`## Components`);
  L.push("");
  L.push(`\`components.jsx\` ships Button, Card, Input (with error state), Nav, and Modal as React components bound to these tokens via Tailwind utilities. They are generic scaffolding styled with *your* proposed system — swap the markup freely, keep the token bindings.`);
  L.push("");
  L.push(`## Usage rules`);
  L.push("");
  if (p.accent) L.push(`- \`accent\` is for primary actions, active states, and links. Body text stays on the neutral ramp.`);
  L.push(`- Never pair adjacent ramp steps for text (e.g. \`neutral-400\` on \`neutral-500\`) — the ramp is built for canvas/ink pairings, check the contrast column.`);
  L.push(`- Stay on the ${p.spacing.slice(0, 4).join("/")}… spacing scale; off-scale one-offs are how the old drift started.`);
  L.push(`- One radius family: sm ${p.radius.sm}px / md ${p.radius.md}px / lg ${p.radius.lg}px, pills for interactive chips only.`);
  L.push("");
  return L.join("\n");
}

function componentsJsx(p) {
  return `// Components bound to the proposed tokens (see tailwind.css in this bundle).
// Generic scaffolding, intentionally unopinionated markup — restyle by editing
// tokens, not components.

export function Button({ variant = "primary", children, ...props }) {
  const styles = {
    primary: "bg-accent text-accent-ink hover:opacity-90",
    ghost: "border border-line text-ink hover:bg-surface",
  };
  return (
    <button
      className={\`inline-flex items-center justify-center h-10 px-5 rounded-md text-sm font-medium transition-[opacity,background-color] active:scale-[0.98] \${styles[variant]}\`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ title, children }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-6">
      {title && <h3 className="text-ink font-medium mb-2">{title}</h3>}
      <div className="text-muted text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function Input({ label, error, id, ...props }) {
  return (
    <div className="grid gap-2">
      {label && (
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={!!error}
        className={\`h-10 px-3 rounded-sm bg-canvas text-ink border outline-none transition-colors placeholder:text-muted \${
          error ? "border-red-500" : "border-line focus:border-accent"
        }\`}
        {...props}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

export function Nav({ brand, links = [], active }) {
  return (
    <header className="bg-canvas border-b border-line">
      <nav className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-8">
        <span className="text-ink font-semibold">{brand}</span>
        <ul className="ml-auto flex items-center gap-6">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className={\`text-sm transition-colors \${
                  active === l.href ? "text-accent" : "text-muted hover:text-ink"
                }\`}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/55"
      />
      <div className="relative bg-surface border border-line rounded-lg p-6 max-w-md w-full">
        <h2 className="text-ink font-medium">{title}</h2>
        <div className="mt-3 text-sm text-muted leading-relaxed">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button>Confirm</Button>
        </div>
      </div>
    </div>
  );
}
`;
}

function proposalTailwind(p) {
  const L = [`@import "tailwindcss";`, ``, `@theme {`];
  L.push(`  /* neutral ramp generated from your canvas undertone */`);
  p.ramp.forEach((r) => L.push(`  --color-${r.name}: ${r.hex};`));
  L.push(``, `  /* semantic */`);
  L.push(`  --color-canvas: ${p.canvas.hex};`);
  L.push(`  --color-surface: ${p.surface.hex};`);
  L.push(`  --color-line: ${p.line.hex};`);
  L.push(`  --color-muted: ${p.muted.hex};`);
  L.push(`  --color-ink: ${p.ink.hex};`);
  if (p.accent) {
    L.push(`  --color-accent: ${p.accent}; /* yours, kept */`);
    L.push(`  --color-accent-ink: ${p.accentInk};`);
  }
  L.push(``);
  L.push(`  --font-sans: "${p.sans}", ui-sans-serif, system-ui, sans-serif;`);
  L.push(`  --font-mono: "${p.mono}", ui-monospace, monospace;`);
  L.push(``);
  p.sizes.forEach((px, i) => {
    const names = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl"];
    if (i < names.length) L.push(`  --text-${names[i]}: ${px / 16}rem;`);
  });
  L.push(``);
  L.push(`  --radius-sm: ${p.radius.sm}px;`);
  L.push(`  --radius-md: ${p.radius.md}px;`);
  L.push(`  --radius-lg: ${p.radius.lg}px;`);
  L.push(`  --radius-full: 9999px;`);
  L.push(``);
  L.push(`  /* spacing scale: ${p.spacing.join(", ")}px */`);
  L.push(`}`, ``);
  return L.join("\n");
}

function proposalTokens(p) {
  const tokens = {
    $description: `Proposed design system for ${p.url} — derived from a live extraction; curated recommendations labeled in $description fields.`,
    color: {},
    semantic: {},
    fontFamily: {
      sans: { $value: p.sans, $type: "fontFamily", $description: p.keepSans ? "extracted from your site" : "curated recommendation" },
      mono: { $value: p.mono, $type: "fontFamily" },
    },
    fontSize: {},
    dimension: {},
    borderRadius: {
      sm: { $value: `${p.radius.sm}px`, $type: "dimension" },
      md: { $value: `${p.radius.md}px`, $type: "dimension" },
      lg: { $value: `${p.radius.lg}px`, $type: "dimension" },
      full: { $value: "9999px", $type: "dimension" },
    },
  };
  p.ramp.forEach((r) => (tokens.color[r.name] = { $value: r.hex, $type: "color" }));
  for (const [k, v] of [
    ["canvas", p.canvas.hex], ["surface", p.surface.hex], ["line", p.line.hex],
    ["text-muted", p.muted.hex], ["ink", p.ink.hex],
    ...(p.accent ? [["accent", p.accent], ["accent-ink", p.accentInk]] : []),
  ]) {
    tokens.semantic[k] = { $value: v, $type: "color" };
  }
  p.sizes.forEach((px, i) => (tokens.fontSize[`size-${i + 1}`] = { $value: `${px / 16}rem`, $type: "dimension" }));
  p.spacing.forEach((px, i) => (tokens.dimension[`space-${i + 1}`] = { $value: `${px}px`, $type: "dimension" }));
  return JSON.stringify(tokens, null, 2);
}
