// Design-system extraction engine.
// Fetches a page + its stylesheets, mines design tokens, and renders
// DESIGN.md, Tailwind v4 @theme CSS, :root CSS variables, and W3C tokens.json.
//
// Every generated statement is DERIVED from mined data. Nothing is invented:
// - color names are computed from the actual hue/lightness of the value
// - semantic roles (canvas/ink/hairline/...) are inferred from usage + luminance,
//   each bound to a distinct value, and labeled as inferred in the output
// - typography prose names only families that exist in the tokens
// - scale names (radius sm..xl, shadow sm.., tracking tight..wide) are assigned
//   in sorted value order, so a "soft"/"sm" name can never point at a larger value

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const PAGE_CAP = 3 * 1024 * 1024; // 3MB
const CSS_CAP = 1024 * 1024; // 1MB per stylesheet
const MAX_SHEETS = 12;

// ponytail: hostname string check only; DNS-rebind-proof SSRF guard if this ever handles auth'd fetches
function assertSafeUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new Error("Only http(s) URLs are supported.");
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^169\.254\./.test(h) ||
    h === "0.0.0.0" ||
    h === "[::1]" ||
    h === "::1"
  )
    throw new Error("Private and local addresses are not allowed.");
  return u;
}

async function fetchText(url, cap) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,text/css,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(
      buf.byteLength > cap ? buf.slice(0, cap) : buf
    );
  } finally {
    clearTimeout(timer);
  }
}

// ---------- CSS collection ----------

function stylesheetUrls(html, baseUrl) {
  const urls = [];
  const linkRe = /<link\b[^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    let href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || href.startsWith("data:")) continue;
    href = href.replace(/&amp;/g, "&");
    try {
      urls.push(new URL(href, baseUrl).href);
    } catch {}
  }
  return [...new Set(urls)].slice(0, MAX_SHEETS);
}

function inlineStyles(html) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// ---------- color math ----------

export function hexFromRgb(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function normalizeColor(str) {
  const s = str.trim().toLowerCase();
  let m;
  if ((m = s.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/))) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4)
      hex = [...hex].map((c) => c + c).join("");
    const alpha = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    if (alpha < 0.15) return null; // near-invisible, skip
    return `#${hex.slice(0, 6)}`;
  }
  if ((m = s.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)$/))) {
    const a = m[4] ? parseFloat(m[4]) / (m[4].endsWith("%") ? 100 : 1) : 1;
    if (a < 0.15) return null;
    return hexFromRgb(+m[1], +m[2], +m[3]);
  }
  if ((m = s.match(/^hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:[,\s/]+([\d.]+%?))?\s*\)$/))) {
    const a = m[4] ? parseFloat(m[4]) / (m[4].endsWith("%") ? 100 : 1) : 1;
    if (a < 0.15) return null;
    const [r, g, b] = hslToRgb(+m[1], +m[2], +m[3]);
    return hexFromRgb(r, g, b);
  }
  return null;
}

function rgbOf(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function luminance(hex) {
  const [r, g, b] = rgbOf(hex).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function hslOf(hex) {
  let [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, l];
}

function colorDistance(a, b) {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function hueWord(h) {
  if (h < 15 || h >= 345) return "red";
  if (h < 40) return "orange";
  if (h < 65) return "yellow";
  if (h < 100) return "lime";
  if (h < 160) return "green";
  if (h < 190) return "teal";
  if (h < 215) return "cyan";
  if (h < 255) return "blue";
  if (h < 275) return "indigo";
  if (h < 305) return "purple";
  return "pink";
}

// Name an accent so the name can never contradict the value:
// lightness qualifies the hue word (a near-black green is "deep-green", not "teal").
function accentName(hex) {
  const [h, , l] = hslOf(hex);
  const base = hueWord(h);
  if (l < 0.22) return `deep-${base}`;
  if (l > 0.85) return `pale-${base}`;
  return base;
}

// ---------- token mining ----------

function mineTokens(css, html) {
  const decls = css;

  // colors
  const colorRe = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
  const counts = new Map();
  let m;
  while ((m = colorRe.exec(decls))) {
    const hex = normalizeColor(m[0]);
    if (hex) counts.set(hex, (counts.get(hex) || 0) + 1);
  }
  const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (theme) {
    const hex = normalizeColor(theme);
    if (hex) counts.set(hex, (counts.get(hex) || 0) + 50);
  }
  // cluster near-duplicates
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const clustered = [];
  for (const [hex, count] of sorted) {
    const near = clustered.find((c) => colorDistance(c.hex, hex) < 20);
    if (near) near.count += count;
    else clustered.push({ hex, count });
  }
  const palette = clustered.slice(0, 40);
  const neutrals = palette
    .filter((c) => hslOf(c.hex)[1] < 0.12)
    .sort((a, b) => luminance(b.hex) - luminance(a.hex))
    .slice(0, 12);
  const accents = palette
    .filter((c) => hslOf(c.hex)[1] >= 0.12)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // oklch / color() raw values (modern CSS, keep verbatim)
  const modern = [...new Set(
    [...decls.matchAll(/(?:oklch|oklab|lch|lab|color)\([^)]+\)/g)].map((x) => x[0])
  )].slice(0, 20);

  // fonts
  const fontCounts = new Map();
  for (const fm of decls.matchAll(/font-family\s*:\s*([^;}{!]+)/gi)) {
    const first = fm[1].split(",")[0].trim().replace(/^["']|["']$/g, "");
    if (!first || /^(inherit|initial|unset|var\()/i.test(first)) continue;
    fontCounts.set(first, (fontCounts.get(first) || 0) + 1);
  }
  for (const gm of html.matchAll(/fonts\.googleapis\.com\/css2?\?[^"']*family=([^&"']+)/gi)) {
    const fam = decodeURIComponent(gm[1]).split(":")[0].replace(/\+/g, " ");
    fontCounts.set(fam, (fontCounts.get(fam) || 0) + 25);
  }
  const generic = new Set([
    "sans-serif", "serif", "monospace", "system-ui", "ui-sans-serif", "ui-serif",
    "ui-monospace", "cursive", "fantasy", "-apple-system",
  ]);
  const fonts = [...fontCounts.entries()]
    .filter(([f]) => !generic.has(f.toLowerCase()))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // font sizes (normalize to px)
  const sizeCounts = new Map();
  for (const sm of decls.matchAll(/font-size\s*:\s*([\d.]+)(px|rem|em)/gi)) {
    let px = parseFloat(sm[1]) * (sm[2].toLowerCase() === "px" ? 1 : 16);
    px = Math.round(px * 100) / 100;
    if (px >= 8 && px <= 160) sizeCounts.set(px, (sizeCounts.get(px) || 0) + 1);
  }
  const fontSizes = [...sizeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([px]) => px)
    .sort((a, b) => a - b);

  // font weights (real usage)
  const weightCounts = new Map();
  for (const wm of decls.matchAll(/font-weight\s*:\s*(\d{3}|bold|normal)/gi)) {
    let w = wm[1].toLowerCase();
    w = w === "bold" ? 700 : w === "normal" ? 400 : parseInt(w, 10);
    if (w >= 100 && w <= 900) weightCounts.set(w, (weightCounts.get(w) || 0) + 1);
  }
  const fontWeights = [...weightCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w, count]) => ({ value: w, count }))
    .sort((a, b) => a.value - b.value);

  // line-heights (unitless only — comparable across sizes)
  const leadingCounts = new Map();
  for (const lm of decls.matchAll(/line-height\s*:\s*([\d.]+)\s*[;}!]/gi)) {
    const v = Math.round(parseFloat(lm[1]) * 100) / 100;
    if (v >= 0.6 && v <= 3) leadingCounts.set(v, (leadingCounts.get(v) || 0) + 1);
  }
  const lineHeights = [...leadingCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([v]) => v)
    .sort((a, b) => a - b);

  // letter-spacings
  const trackCounts = new Map();
  for (const tm of decls.matchAll(/letter-spacing\s*:\s*(-?[\d.]+(?:px|em|rem))/gi)) {
    const v = tm[1];
    trackCounts.set(v, (trackCounts.get(v) || 0) + 1);
  }
  const toEm = (v) =>
    v.endsWith("em") ? parseFloat(v) : parseFloat(v) / 16;
  const letterSpacings = [...trackCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([v]) => v)
    .sort((a, b) => toEm(a) - toEm(b));

  // spacing
  const spaceCounts = new Map();
  for (const pm of decls.matchAll(/(?:padding|margin|gap|row-gap|column-gap)[^:;{}]*:\s*([^;}{!]+)/gi)) {
    for (const vm of pm[1].matchAll(/([\d.]+)(px|rem)/g)) {
      let px = parseFloat(vm[1]) * (vm[2] === "px" ? 1 : 16);
      px = Math.round(px);
      if (px > 0 && px <= 200) spaceCounts.set(px, (spaceCounts.get(px) || 0) + 1);
    }
  }
  const spacing = [...spaceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([px]) => px)
    .sort((a, b) => a - b);

  // radii (raw; merged/deduped in normalizeTokens)
  const radiusCounts = new Map();
  for (const rm of decls.matchAll(/border-radius\s*:\s*([^;}{!]+)/gi)) {
    const v = rm[1].trim().split(/\s+/)[0];
    if (/^([\d.]+(px|rem|%)|9999px|50%)$/.test(v))
      radiusCounts.set(v, (radiusCounts.get(v) || 0) + 1);
  }
  const radii = [...radiusCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([v, count]) => ({ value: v, count }));

  // shadows (raw; noise-filtered in normalizeTokens)
  const shadowCounts = new Map();
  for (const sm of decls.matchAll(/box-shadow\s*:\s*([^;}{!]+)/gi)) {
    const v = sm[1].trim().replace(/\s+/g, " ");
    if (v && v !== "none" && v.length < 220)
      shadowCounts.set(v, (shadowCounts.get(v) || 0) + 1);
  }
  const shadows = [...shadowCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([value, count]) => ({ value, count, blur: shadowBlur(value) }));

  // breakpoints
  const bpSet = new Set();
  for (const bm of decls.matchAll(/@media[^{]*\(\s*(?:min|max)-width\s*:\s*([\d.]+)(px|em|rem)/gi)) {
    const px = Math.round(parseFloat(bm[1]) * (bm[2] === "px" ? 1 : 16));
    if (px >= 320 && px <= 2600) bpSet.add(px);
  }
  const breakpoints = [...bpSet].sort((a, b) => a - b).slice(0, 8);

  // native custom properties (prefer :root blocks)
  const nativeVars = [];
  const seen = new Set();
  const rootBlocks = [...decls.matchAll(/:root[^{}]*\{([^}]*)\}/gi)].map((x) => x[1]);
  const scopes = rootBlocks.length ? rootBlocks : [decls];
  for (const scope of scopes) {
    for (const vm of scope.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)) {
      const name = vm[1];
      const value = vm[2].trim();
      if (seen.has(name) || value.length > 160) continue;
      seen.add(name);
      nativeVars.push({ name, value });
      if (nativeVars.length >= 120) break;
    }
    if (nativeVars.length >= 120) break;
  }

  const darkVars = mineDarkVars(decls, nativeVars);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0, 120) || "";
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]?.slice(0, 200) || "";

  // theme guess: measured weight of dark vs light neutral usage
  const darkWeight = neutrals
    .filter((c) => luminance(c.hex) < 0.2)
    .reduce((s, c) => s + c.count, 0);
  const lightWeight = neutrals
    .filter((c) => luminance(c.hex) > 0.6)
    .reduce((s, c) => s + c.count, 0);
  const themeGuess = darkWeight > lightWeight * 1.5 ? "dark-leaning" : "light-leaning";

  return {
    title, description, themeGuess, darkWeight, lightWeight,
    neutrals, accents, modern,
    fonts, fontSizes, fontWeights, lineHeights, letterSpacings,
    spacing, radii, shadows, breakpoints, nativeVars, darkVars,
  };
}

// Dark-mode variants. Three mechanisms, all real CSS on the page:
// light-dark() pairs, @media (prefers-color-scheme: dark) blocks,
// and .dark / [data-theme="dark"] selector overrides.
function mineDarkVars(css, nativeVars) {
  const dark = new Map();

  for (const m of css.matchAll(/--([\w-]+)\s*:\s*light-dark\(\s*([^,()]+(?:\([^()]*\))?)\s*,\s*([^()]+(?:\([^()]*\))?)\s*\)/g)) {
    dark.set(m[1], { light: m[2].trim(), dark: m[3].trim(), via: "light-dark()" });
  }

  // brace-matched scan for prefers-color-scheme: dark media blocks
  const mediaRe = /@media[^{]*prefers-color-scheme\s*:\s*dark[^{]*\{/g;
  let mm;
  while ((mm = mediaRe.exec(css))) {
    let depth = 1;
    let i = mediaRe.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    const block = css.slice(mediaRe.lastIndex, i - 1);
    for (const vm of block.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)) {
      if (!dark.has(vm[1]))
        dark.set(vm[1], { light: null, dark: vm[2].trim(), via: "prefers-color-scheme" });
    }
  }

  for (const sm of css.matchAll(/(?:\.dark\b|\[data-(?:theme|color-mode|mode|appearance)\s*[*^|~]?=\s*["']?dark["']?\])[^{}]*\{([^{}]*)\}/g)) {
    for (const vm of sm[1].matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)) {
      if (!dark.has(vm[1]))
        dark.set(vm[1], { light: null, dark: vm[2].trim(), via: "dark selector" });
    }
  }

  const lightMap = new Map(nativeVars.map((v) => [v.name, v.value]));
  return [...dark.entries()]
    .map(([name, v]) => ({
      name,
      light: v.light ?? lightMap.get(name) ?? null,
      dark: v.dark,
      via: v.via,
    }))
    .filter((d) => d.dark && d.dark.length < 120)
    .slice(0, 60);
}

// first shadow segment: x y blur [spread] color — blur is the 3rd length
function shadowBlur(shadow) {
  const seg = shadow.split(",")[0];
  const lens = [...seg.matchAll(/(-?[\d.]+)(?:px|rem|em)/g)].map((x) => parseFloat(x[1]));
  return lens.length >= 3 ? Math.abs(lens[2]) : 0;
}

// `0 0 0 Npx color` is a focus ring / outline, not an elevation shadow
function isRing(shadow) {
  return /^(inset\s+)?0(?:px)?\s+0(?:px)?\s+0(?:px)?\s+-?[\d.]/.test(shadow.trim());
}

// Clean mined data before generation (idempotent, also runs on --regen):
// - shadows: drop CSS-variable soup, split real shadows from focus rings
// - radii: merge values within 1px of each other, cap to the name scale
function normalizeTokens(t) {
  const realShadows = [];
  const rings = t.rings ? [...t.rings] : [];
  for (const s of t.shadows || []) {
    if (s.value.includes("var(--")) continue; // unresolved variable soup, not a value
    if (isRing(s.value)) {
      if (!rings.some((r) => r.value === s.value)) rings.push(s);
    } else {
      realShadows.push({ ...s, blur: shadowBlur(s.value) });
    }
  }

  const pills = [];
  const finite = [];
  for (const r of [...(t.radii || [])].sort((a, b) => b.count - a.count)) {
    if (/9999|50%/.test(r.value)) {
      if (pills.length === 0) pills.push({ ...r });
      else pills[0].count += r.count; // 9999px and 50% are the same intent
      continue;
    }
    const px = radiusPx(r.value);
    const near = finite.find((x) => Math.abs(radiusPx(x.value) - px) <= 1);
    if (near) near.count += r.count; // 10px next to 11px is one token, not two
    else finite.push({ ...r });
  }

  return {
    ...t,
    shadows: realShadows.slice(0, 6),
    rings: rings.slice(0, 3),
    radii: [...finite.slice(0, 7), ...pills],
  };
}

// WCAG contrast ratio between two hexes
export function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

// How sure are we about the primary typeface, from raw usage counts?
export function fontConfidence(fonts) {
  if (!fonts.length) return "none";
  const top = fonts[0].count;
  const second = fonts[1]?.count ?? 0;
  if (top >= 5 && top >= second * 2) return "high";
  if (top >= 3 && top > second) return "medium";
  return "low";
}

// ---------- naming ----------

function nameColors(t) {
  const named = [];
  // neutrals: bucket by luminance onto a 50..950 scale.
  // t.neutrals is sorted light -> dark, so slots are assigned monotonically:
  // a darker color can never take a lighter slot than its predecessor.
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  let last = -1;
  for (const c of t.neutrals) {
    const l = luminance(c.hex);
    let idx = Math.min(steps.length - 1, Math.round((1 - Math.sqrt(l)) * (steps.length - 1)));
    idx = Math.max(idx, last + 1);
    if (idx >= steps.length) break; // out of slots
    last = idx;
    named.push({ name: `neutral-${steps[idx]}`, hex: c.hex, count: c.count, group: "neutral" });
  }
  // accents: hue + lightness names computed from the value, suffix on collision
  const used = new Map();
  for (const c of t.accents) {
    const base = accentName(c.hex);
    const n = (used.get(base) || 0) + 1;
    used.set(base, n);
    named.push({
      name: n === 1 ? base : `${base}-${n}`,
      hex: c.hex, count: c.count, group: "accent",
    });
  }
  return named;
}

// Infer semantic roles. Each role gets a DISTINCT color; a role with no
// distinct honest candidate is simply omitted.
function inferRoles(t, colors) {
  const dark = t.themeGuess === "dark-leaning";
  const neutrals = colors.filter((c) => c.group === "neutral");
  const accents = colors.filter((c) => c.group === "accent");
  const roles = [];
  const taken = new Set();

  const claim = (role, c, why) => {
    if (!c || taken.has(c.hex)) return;
    taken.add(c.hex);
    roles.push({ role, name: c.name, hex: c.hex, why });
  };

  const byLum = [...neutrals].sort((a, b) => luminance(b.hex) - luminance(a.hex)); // light -> dark
  const lightEnd = byLum[0];
  const darkEnd = byLum[byLum.length - 1];
  const canvas = dark ? darkEnd : lightEnd;
  const ink = dark ? lightEnd : darkEnd;
  claim("canvas", canvas, `${dark ? "darkest" : "lightest"} neutral, matches the measured ${t.themeGuess} theme`);
  if (ink !== canvas) claim("ink", ink, `${dark ? "lightest" : "darkest"} neutral, highest contrast against canvas`);

  // muted text must still read against canvas: keep to the middle band
  const mid = neutrals
    .filter((c) => !taken.has(c.hex))
    .map((c) => ({ c, l: luminance(c.hex) }))
    .filter(({ l }) => l >= 0.15 && l <= 0.55)
    .sort((a, b) => b.c.count - a.c.count)[0]?.c;
  claim("text-muted", mid, "most-used mid-luminance neutral");

  const nearCanvas = neutrals
    .filter((c) => !taken.has(c.hex))
    .map((c) => ({ c, d: Math.abs(luminance(c.hex) - luminance(canvas?.hex || (dark ? "#000000" : "#ffffff"))) }))
    .sort((a, b) => a.d - b.d);
  claim("surface", nearCanvas[0]?.c, "neutral closest to canvas luminance");
  claim("hairline", nearCanvas[1]?.c, "next neutral near canvas, hairline-border weight");

  accents.slice(0, 3).forEach((a, i) => {
    claim(i === 0 ? "accent" : `accent-${i + 1}`, a, i === 0 ? "most-used chromatic color" : "supporting chromatic color");
  });

  return roles;
}

// ordered relative names — assigned by sorted value, so they can't invert
const TRACK_NAMES = ["tightest", "tighter", "tight", "normal", "wide", "wider"];
const LEAD_NAMES = ["none", "tight", "snug", "normal", "relaxed", "loose", "looser", "loosest"];
const SHADOW_NAMES = ["sm", "md", "lg", "xl", "2xl", "3xl"];
const SIZE_NAMES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl"];

function radiusName(i) {
  const scale = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl"];
  return scale[Math.min(i, scale.length - 1)];
}

function weightName(w) {
  const names = { 100: "thin", 200: "extralight", 300: "light", 400: "normal", 500: "medium", 600: "semibold", 700: "bold", 800: "extrabold", 900: "black" };
  return names[w] || String(w);
}

function slugFont(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// classify families once; every artifact and every prose sentence uses this
export function classifyFonts(fonts) {
  const stacks = { sans: null, serif: null, mono: null };
  for (const f of fonts) {
    const n = f.name.toLowerCase();
    if (!stacks.mono && /(mono|code|courier|consolas)/.test(n)) stacks.mono = f.name;
    else if (!stacks.serif && /(serif|georgia|garamond|playfair|times)/.test(n) && !/sans/.test(n)) stacks.serif = f.name;
    else if (!stacks.sans) stacks.sans = f.name;
  }
  return stacks;
}

// normalize a radius to px for comparison (pills sort last)
function radiusPx(v) {
  if (/9999|50%/.test(v)) return Infinity;
  const n = parseFloat(v);
  return v.endsWith("rem") ? n * 16 : v.endsWith("em") ? n * 16 : n;
}

function sortedRadii(t) {
  return [...t.radii].sort((a, b) => radiusPx(a.value) - radiusPx(b.value));
}

function sortedShadows(t) {
  return [...t.shadows].sort((a, b) => a.blur - b.blur);
}

// ---------- generators ----------

function overviewProse(t, colors, roles, stacks) {
  const neutrals = colors.filter((c) => c.group === "neutral");
  const accents = colors.filter((c) => c.group === "accent");
  const s = [];

  const dark = t.themeGuess === "dark-leaning";
  s.push(
    `The system reads as ${dark ? "dark" : "light"}: measured neutral usage weighs ${dark ? t.darkWeight : t.lightWeight} ${dark ? "dark" : "light"} against ${dark ? t.lightWeight : t.darkWeight} ${dark ? "light" : "dark"}.`
  );

  if (accents.length === 0) {
    s.push(`The palette is fully achromatic — ${neutrals.length} neutrals and no saturated color survived extraction.`);
  } else if (neutrals.length >= accents.length * 2) {
    s.push(`The palette leans monochrome: ${neutrals.length} neutrals carry the structure while ${accents.length} chromatic value${accents.length > 1 ? "s" : ""} (led by ${accents[0].name}, \`${accents[0].hex}\`) supply accent.`);
  } else {
    s.push(`The palette is chromatic: ${accents.length} saturated values against ${neutrals.length} neutrals, led by ${accents[0].name} (\`${accents[0].hex}\`).`);
  }

  const conf = fontConfidence(t.fonts);
  if (conf === "high" && (stacks.sans || stacks.serif)) {
    const parts = [];
    if (stacks.sans) parts.push(`**${stacks.sans}** carries the interface`);
    if (stacks.serif) parts.push(`**${stacks.serif}** appears in serif roles`);
    if (stacks.mono) parts.push(`**${stacks.mono}** handles code and data`);
    s.push(parts.join("; ") + ".");
  } else if (conf === "medium" && stacks.sans) {
    s.push(`**${stacks.sans}** leads the font stack, though usage counts are close — verify against rendered pages before committing.`);
  } else if (conf === "low") {
    s.push(
      `Font usage counts are low and close together (${t.fonts.slice(0, 3).map((f) => `${f.name}: ${f.count}`).join(", ")}) — the extractor can't confidently call a primary face from CSS alone.`
    );
  } else if (t.fonts.length === 0) {
    s.push(`No custom font families were found — the site runs on system font stacks.`);
  }

  const r = sortedRadii(t);
  if (r.length) {
    const smallest = radiusPx(r[0].value);
    const hasPill = r.some((x) => /9999|50%/.test(x.value));
    const largestFinite = [...r].reverse().find((x) => !/9999|50%/.test(x.value));
    if (hasPill && smallest <= 4) s.push(`Geometry mixes sharp corners (${r[0].value}) with full pills.`);
    else if (hasPill) s.push(`Rounded geometry throughout, up to full pills.`);
    else if (smallest === 0) s.push(`Corners are square-first (0px radius dominates the scale).`);
    else if (largestFinite) s.push(`Corner radii run ${r[0].value} to ${largestFinite.value}.`);
  }

  if (t.shadows.length === 0) s.push(`No box-shadows were found — depth comes from color contrast, not elevation.`);

  return s.join(" ");
}

function yamlFrontmatter(url, t, roles, stacks) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const lines = ["---"];
  lines.push(`name: ${host.replace(/\./g, "-")}-design-system`);
  lines.push(`source: ${url}`);
  lines.push(`extracted: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(`theme: ${t.themeGuess.replace("-leaning", "")}  # measured from neutral usage weight`);
  if (roles.length) {
    lines.push(`colors:  # roles inferred from usage frequency + luminance; names verified against values`);
    for (const r of roles) {
      const [h] = hslOf(r.hex);
      const note = r.role.startsWith("accent") ? `  # ${accentName(r.hex)}` : "";
      lines.push(`  ${r.role}: "${r.hex}"${note}`);
    }
  }
  const conf = fontConfidence(t.fonts);
  const confNote = conf === "high" ? "" : `  # ${conf}-confidence: usage counts are ${conf === "low" ? "low and close" : "close"}`;
  const fontLines = [];
  if (stacks.sans) fontLines.push(`  primary: "${stacks.sans}"${confNote}`);
  if (stacks.serif) fontLines.push(`  serif: "${stacks.serif}"`);
  if (stacks.mono) fontLines.push(`  mono: "${stacks.mono}"`);
  if (fontLines.length) {
    lines.push("fonts:");
    lines.push(...fontLines);
  }
  lines.push("---");
  return lines.join("\n");
}

// Rules the data actually supports — each one cites its measurement.
function usageRules(t, colors, roles, stacks) {
  const rules = [];
  const neutrals = colors.filter((c) => c.group === "neutral");
  const accents = colors.filter((c) => c.group === "accent");
  const totalUse = [...neutrals, ...accents].reduce((s, c) => s + c.count, 0);
  const accentUse = accents.reduce((s, c) => s + c.count, 0);
  const accent = roles.find((r) => r.role === "accent");

  if (accent && totalUse > 0) {
    const share = Math.round((accentUse / totalUse) * 100);
    if (share <= 25)
      rules.push(
        `Chromatic color is only ${share}% of measured color usage. Reserve \`accent\` (\`${accent.hex}\`) for primary actions, links, and emphasis — spreading it into body text or large surfaces breaks the ratio that defines this look.`
      );
    else
      rules.push(
        `Chromatic color carries ${share}% of measured usage — this palette uses color structurally. Saturated values can hold large surfaces here; timidity would misrepresent the source.`
      );
  }
  if (!accents.length)
    rules.push(`The palette is achromatic. Introduce color only through content (imagery, media), never through UI chrome.`);

  const dark = t.themeGuess === "dark-leaning";
  rules.push(
    `The theme is ${dark ? "dark" : "light"} (measured neutral weight ${dark ? t.darkWeight : t.lightWeight}:${dark ? t.lightWeight : t.darkWeight}). Don't flip individual sections to the opposite mode.`
  );

  const dom = [...t.radii].sort((a, b) => b.count - a.count)[0];
  if (dom) {
    const px = radiusPx(dom.value);
    if (px === 0)
      rules.push(`Square corners dominate (\`0px\`, x${dom.count}) — don't introduce rounded corners without a reason.`);
    else if (px === Infinity)
      rules.push(`The most-used radius is the full pill (x${dom.count}); mid-size radii are the exception in this system.`);
    else
      rules.push(`\`${dom.value}\` is the workhorse radius (x${dom.count}); treat the other radii as exceptions, not options.`);
  }

  if (!t.shadows.length)
    rules.push(`No elevation shadows were found — build depth with tonal contrast between surfaces, not box-shadows.`);
  else {
    const maxBlur = Math.max(...t.shadows.map((s) => s.blur));
    if (maxBlur === 0)
      rules.push(`The only shadows are blur-less hairline offsets — this system barely uses elevation; don't add soft drop shadows.`);
    else if (maxBlur <= 12)
      rules.push(`Shadows stay tight (max ${maxBlur}px blur) — keep elevation subtle if you extend the scale.`);
  }

  const onGrid = t.spacing.filter((px) => px % 4 === 0).length;
  if (t.spacing.length >= 4 && onGrid / t.spacing.length >= 0.8)
    rules.push(`Spacing sits on a 4px grid (${onGrid} of ${t.spacing.length} values divisible by 4) — stay on it.`);

  if (stacks.sans && !stacks.serif && t.fonts.length <= 3 && fontConfidence(t.fonts) !== "low" && t.fontWeights.length)
    rules.push(
      `One family does the work — build hierarchy with size and weight (${t.fontWeights.map((w) => w.value).join("/")}), not by adding typefaces.`
    );
  if (stacks.mono)
    rules.push(`\`${stacks.mono}\` is the monospace — keep it for code, data, and metadata roles.`);

  return rules;
}

// Token compositions with computed contrast. Not observed components —
// labeled as such in the output.
function starterRecipes(t, roles, colors) {
  const get = (role) => roles.find((r) => r.role === role);
  const accent = get("accent");
  const canvas = get("canvas");
  const ink = get("ink");
  const surface = get("surface");
  const hairline = get("hairline");
  const muted = get("text-muted");

  const r = sortedRadii(t);
  const pill = r.find((x) => /9999|50%/.test(x.value));
  const finite = r.filter((x) => !/9999|50%/.test(x.value));
  const smallR = finite[0]?.value || null;
  // the most-used finite radius is what containers actually wear;
  // the largest is often a one-off (marquee, avatar) and would mislead
  const domR = [...finite].sort((a, b) => b.count - a.count)[0]?.value || smallR;
  const weights = t.fontWeights.map((w) => w.value);
  const btnWeight = weights.includes(500) ? 500 : weights.includes(600) ? 600 : weights[weights.length - 1];
  const sh = sortedShadows(t);

  const recipes = [];
  if (accent && (canvas || ink)) {
    const best = [canvas, ink]
      .filter(Boolean)
      .sort((a, b) => contrast(b.hex, accent.hex) - contrast(a.hex, accent.hex))[0];
    const ratio = contrast(best.hex, accent.hex);
    recipes.push({
      name: "button-primary",
      lines: [
        `background: var(--color-accent); /* ${accent.hex} */`,
        `color: var(--color-${best.role}); /* ${best.hex} — contrast ${ratio.toFixed(1)}:1${ratio < 4.5 ? ", below AA for small text; use large or bold labels" : ""} */`,
        pill ? `border-radius: 9999px; /* pill — mined as ${pill.value} */` : smallR ? `border-radius: ${smallR};` : null,
        btnWeight ? `font-weight: ${btnWeight};` : null,
      ].filter(Boolean),
    });
  }
  if ((surface || canvas) && hairline) {
    const bg = surface || canvas;
    recipes.push({
      name: "card",
      lines: [
        `background: var(--color-${bg.role}); /* ${bg.hex} */`,
        `border: 1px solid var(--color-hairline); /* ${hairline.hex} */`,
        domR ? `border-radius: ${domR}; /* most-used finite radius */` : null,
        sh[0] ? `box-shadow: var(--shadow-sm);` : `/* no shadow — this system builds depth with tonal contrast */`,
      ].filter(Boolean),
    });
  }
  if (canvas && ink && hairline) {
    recipes.push({
      name: "input",
      lines: [
        `background: var(--color-canvas); /* ${canvas.hex} */`,
        `color: var(--color-ink); /* ${ink.hex} — contrast ${contrast(ink.hex, canvas.hex).toFixed(1)}:1 */`,
        `border: 1px solid var(--color-hairline); /* ${hairline.hex} */`,
        smallR ? `border-radius: ${smallR};` : null,
        muted ? `/* placeholder color: var(--color-text-muted) ${muted.hex} */` : null,
      ].filter(Boolean),
    });
  }

  // nav: canvas ground + hairline separation, accent marks the active item
  if (canvas && ink && hairline) {
    recipes.push({
      name: "nav",
      lines: [
        `background: var(--color-canvas); /* ${canvas.hex} */`,
        `border-bottom: 1px solid var(--color-hairline); /* ${hairline.hex} */`,
        `color: var(--color-ink); /* ${ink.hex} */`,
        muted ? `/* inactive links: var(--color-text-muted) ${muted.hex} */` : null,
        accent ? `/* active link: var(--color-accent) ${accent.hex} — contrast vs canvas ${contrast(accent.hex, canvas.hex).toFixed(1)}:1 */` : null,
      ].filter(Boolean),
    });
  }

  // modal: elevated surface + computed scrim from the ink end of the palette
  if ((surface || canvas) && ink) {
    const bg = surface || canvas;
    const biggest = sh[sh.length - 1];
    recipes.push({
      name: "modal",
      lines: [
        `background: var(--color-${bg.role}); /* ${bg.hex} */`,
        domR ? `border-radius: ${domR};` : null,
        biggest
          ? `box-shadow: var(--shadow-${SHADOW_NAMES[sh.length - 1] || sh.length - 1}); /* largest mined shadow */`
          : hairline ? `border: 1px solid var(--color-hairline); /* no shadows mined — hairline instead */` : null,
      ].filter(Boolean),
    });
    recipes.push({
      name: "modal-backdrop",
      lines: [
        `background: color-mix(in srgb, var(--color-ink) 55%, transparent); /* scrim from ${ink.hex} */`,
      ],
    });
  }

  // validation: only if the mined palette actually contains red / green
  const accentsAll = (colors || []).filter((c) => c.group === "accent");
  const redish = accentsAll.find((c) => { const [h] = hslOf(c.hex); return h < 20 || h >= 345; });
  const greenish = accentsAll.find((c) => { const [h] = hslOf(c.hex); return h >= 90 && h < 165; });
  if (redish && canvas) {
    recipes.push({
      name: "input-error",
      lines: [
        `border-color: ${redish.hex}; /* mined token: ${redish.name} */`,
        `/* error text: ${redish.hex} on canvas — contrast ${contrast(redish.hex, canvas.hex).toFixed(1)}:1${contrast(redish.hex, canvas.hex) < 4.5 ? ", below AA; darken for message text" : ""} */`,
      ],
    });
  }
  if (greenish && canvas) {
    recipes.push({
      name: "input-success",
      lines: [
        `border-color: ${greenish.hex}; /* mined token: ${greenish.name} */`,
      ],
    });
  }
  if (!redish) {
    recipes.push({
      name: "input-error",
      lines: [
        `/* no red exists in the mined palette — this site does not expose an error color in its CSS. */`,
        `/* Introduce one deliberately rather than borrowing a random red; keep saturation near the accent's. */`,
      ],
    });
  }

  return recipes;
}

function genDesignMd(url, t, colors, roles, stacks) {
  const conf = fontConfidence(t.fonts);
  const lines = [];
  lines.push(yamlFrontmatter(url, t, roles, stacks));
  lines.push("");
  lines.push(`# ${t.title || new URL(url).hostname} — Design System`);
  lines.push("");
  lines.push(`Extracted from **${url}** on ${new Date().toISOString().slice(0, 10)}.`);
  if (t.description) lines.push(`\n> ${t.description}`);
  lines.push("");
  lines.push(
    `Every value below is mined from the site's live CSS (${t.nativeVars.length} native custom properties, ranked usage counts). ` +
    `Role assignments are inferred from usage and luminance and marked as such — treat them as a strong starting point, not gospel.`
  );
  lines.push("");
  lines.push(`## Overview`);
  lines.push("");
  lines.push(overviewProse(t, colors, roles, stacks));
  lines.push("");

  // usage rules: each cites the measurement that backs it
  const rules = usageRules(t, colors, roles, stacks);
  if (rules.length) {
    lines.push(`## Usage rules`);
    lines.push("");
    lines.push(`Derived from the measured usage below — each rule cites its evidence.`);
    lines.push("");
    rules.forEach((r) => lines.push(`- ${r}`));
    lines.push("");
  }

  // colors
  lines.push(`## Colors`);
  lines.push("");
  const roleByHex = new Map(roles.map((r) => [r.hex, r]));
  const neutrals = colors.filter((c) => c.group === "neutral");
  const accents = colors.filter((c) => c.group === "accent");
  if (neutrals.length) {
    lines.push(`### Neutrals (light → dark)`);
    lines.push("", `| Token | Value | Usage | Inferred role |`, `| --- | --- | --- | --- |`);
    for (const c of neutrals) {
      const r = roleByHex.get(c.hex);
      lines.push(`| \`${c.name}\` | \`${c.hex}\` | ${c.count} | ${r ? `**${r.role}** — ${r.why}` : "—"} |`);
    }
    lines.push("");
  }
  if (accents.length) {
    lines.push(`### Accents`);
    lines.push("", `| Token | Value | Usage | Inferred role |`, `| --- | --- | --- | --- |`);
    for (const c of accents) {
      const r = roleByHex.get(c.hex);
      lines.push(`| \`${c.name}\` | \`${c.hex}\` | ${c.count} | ${r ? `**${r.role}** — ${r.why}` : "—"} |`);
    }
    lines.push("");
  }
  if (t.modern.length) {
    lines.push(`### Modern color values (kept verbatim)`);
    lines.push("");
    t.modern.slice(0, 12).forEach((v) => lines.push(`- \`${v}\``));
    lines.push("");
  }

  // dark mode: only when the source actually defines variants
  if (t.darkVars?.length) {
    const mechanisms = [...new Set(t.darkVars.map((d) => d.via))].join(", ");
    lines.push(`### Dark mode`);
    lines.push("");
    lines.push(
      `The source defines ${t.darkVars.length} dark-mode variant${t.darkVars.length > 1 ? "s" : ""} (via ${mechanisms}). Both halves of the system, first ${Math.min(t.darkVars.length, 30)}:`
    );
    lines.push("", `| Token | Light | Dark |`, `| --- | --- | --- |`);
    t.darkVars.slice(0, 30).forEach((d) =>
      lines.push(`| \`--${d.name}\` | ${d.light ? `\`${d.light}\`` : "—"} | \`${d.dark}\` |`)
    );
    lines.push("");
    lines.push(`\`variables.css\` ships these as a \`prefers-color-scheme: dark\` override block.`);
    lines.push("");
  }

  // typography
  lines.push(`## Typography`);
  lines.push("");
  if (t.fonts.length) {
    if (conf === "high") {
      const parts = [];
      if (stacks.sans) parts.push(`**${stacks.sans}** is the primary interface face`);
      if (stacks.serif) parts.push(`**${stacks.serif}** covers serif roles`);
      if (stacks.mono) parts.push(`**${stacks.mono}** is the monospace`);
      lines.push(parts.join("; ") + ". Full list by usage:");
    } else if (conf === "medium") {
      lines.push(
        `**${stacks.sans}** has the most \`font-family\` declarations, but the margin over the rest is thin — treat the primary-face call as provisional and verify on rendered pages. Full list by usage:`
      );
    } else {
      lines.push(
        `Usage counts here are low and close together, so no family can be confidently called primary from CSS declarations alone — sites that set fonts via shorthand or JS under-count. Verify visually. Full list by usage:`
      );
    }
    lines.push("", `| Family | Usage |`, `| --- | --- |`);
    t.fonts.forEach((f) => lines.push(`| ${f.name} | ${f.count} |`));
    lines.push("");
  } else {
    lines.push(`No explicit custom font families found — the site relies on system font stacks.`);
    lines.push("");
  }
  if (t.fontSizes.length)
    lines.push(`**Size scale (px):** ${t.fontSizes.map((s) => `\`${s}\``).join(", ")}`, "");
  if (t.fontWeights.length)
    lines.push(`**Weights in use:** ${t.fontWeights.map((w) => `\`${w.value}\` (x${w.count})`).join(", ")}`, "");
  if (t.lineHeights.length)
    lines.push(`**Line-heights (unitless):** ${t.lineHeights.map((v) => `\`${v}\``).join(", ")}`, "");
  if (t.letterSpacings.length)
    lines.push(`**Letter-spacing values:** ${t.letterSpacings.map((v) => `\`${v}\``).join(", ")}`, "");

  // spacing / radius / shadows / breakpoints
  if (t.spacing.length) {
    lines.push(`## Spacing`);
    lines.push("");
    lines.push(`Most-used values (px): ${t.spacing.map((s) => `\`${s}\``).join(", ")}`);
    const onGrid = t.spacing.filter((px) => px % 4 === 0).length;
    if (t.spacing.length >= 4 && onGrid / t.spacing.length >= 0.8)
      lines.push("", `${onGrid} of ${t.spacing.length} values sit on a 4px grid.`);
    lines.push("");
  }
  const r = sortedRadii(t);
  if (r.length) {
    lines.push(`## Border radius`);
    lines.push("", `| Token | Value | Usage |`, `| --- | --- | --- |`);
    r.forEach((x, i) => {
      const name = /9999|50%/.test(x.value) ? "full" : radiusName(i);
      lines.push(`| \`radius-${name}\` | \`${x.value}\` | ${x.count} |`);
    });
    lines.push("");
  }
  const sh = sortedShadows(t);
  if (sh.length) {
    lines.push(`## Shadows (ordered by blur radius)`);
    lines.push("");
    sh.forEach((s, i) => lines.push(`- \`shadow-${SHADOW_NAMES[i] || i}\` — \`${s.value}\` (x${s.count})`));
    lines.push("");
  }
  if (t.rings?.length) {
    lines.push(`### Focus rings (spread-only box-shadows, kept out of the elevation scale)`);
    lines.push("");
    t.rings.forEach((r) => lines.push(`- \`${r.value}\` (x${r.count})`));
    lines.push("");
  }
  if (t.breakpoints.length) {
    lines.push(`## Breakpoints`);
    lines.push("");
    lines.push(t.breakpoints.map((b) => `\`${b}px\``).join(", "));
    lines.push("");
  }

  // starter recipes: token compositions, contrast computed
  const recipes = starterRecipes(t, roles, colors);
  if (recipes.length) {
    lines.push(`## Starter recipes`);
    lines.push("");
    lines.push(
      `Tokens composed into components. The source site's real components were **not** inspected — these are starting points built from the extracted values, with contrast ratios computed rather than assumed.`
    );
    lines.push("", "```css");
    recipes.forEach((rec, i) => {
      if (i) lines.push("");
      lines.push(`.${rec.name} {`);
      rec.lines.forEach((l) => lines.push(`  ${l}`));
      lines.push(`}`);
    });
    lines.push("```", "");
  }

  // observations: only measurable facts
  const obs = [];
  if (neutrals.length && accents.length)
    obs.push(`${neutrals.length} of ${neutrals.length + accents.length} extracted colors are neutrals.`);
  if (sh.length) obs.push(`${sh.length} distinct shadow${sh.length > 1 ? "s" : ""}; the softest reaches ${sh[sh.length - 1].blur}px blur.`);
  if (t.breakpoints.length) obs.push(`${t.breakpoints.length} breakpoints, from ${t.breakpoints[0]}px to ${t.breakpoints[t.breakpoints.length - 1]}px.`);
  if (t.nativeVars.length >= 100) obs.push(`The site ships a large native token system (${t.nativeVars.length}+ custom properties) — prefer those names when extending it.`);
  if (obs.length) {
    lines.push(`## Observations`);
    lines.push("");
    obs.forEach((o) => lines.push(`- ${o}`));
    lines.push("");
  }

  if (t.nativeVars.length) {
    lines.push(`## Native CSS custom properties`);
    lines.push("");
    lines.push(`First ${Math.min(t.nativeVars.length, 40)} of ${t.nativeVars.length}:`);
    lines.push("", "```css", ":root {");
    t.nativeVars.slice(0, 40).forEach((v) => lines.push(`  --${v.name}: ${v.value};`));
    lines.push("}", "```", "");
  }

  lines.push(`## Files`);
  lines.push("");
  lines.push(`- \`tailwind.css\` — Tailwind v4 \`@theme\` block; tokens become utilities (e.g. \`bg-neutral-900\`${accents[0] ? `, \`text-${accents[0].name}\`` : ""}).`);
  lines.push(`- \`variables.css\` — framework-agnostic \`:root\` variables, same values.`);
  lines.push(`- \`tokens.json\` — W3C Design Tokens format for Figma plugins, Style Dictionary, etc.`);
  lines.push("");
  return lines.join("\n");
}

function genTailwind(t, colors, roles, stacks) {
  const lines = [`@import "tailwindcss";`, ``, `@theme {`];
  lines.push(`  /* palette (mined, ranked by usage) */`);
  for (const c of colors) lines.push(`  --color-${c.name}: ${c.hex};`);
  if (roles.length) {
    lines.push(``, `  /* inferred semantic roles (each maps to a distinct mined value) */`);
    for (const r of roles) lines.push(`  --color-${r.role}: ${r.hex};`);
  }
  if (stacks.sans || stacks.serif || stacks.mono) {
    lines.push(``);
    if (stacks.sans) lines.push(`  --font-sans: "${stacks.sans}", ui-sans-serif, system-ui, sans-serif;`);
    if (stacks.serif) lines.push(`  --font-serif: "${stacks.serif}", ui-serif, Georgia, serif;`);
    if (stacks.mono) lines.push(`  --font-mono: "${stacks.mono}", ui-monospace, monospace;`);
  }
  if (t.fontSizes.length) {
    lines.push(``);
    t.fontSizes.forEach((px, i) => {
      if (i < SIZE_NAMES.length) lines.push(`  --text-${SIZE_NAMES[i]}: ${px / 16}rem;`);
    });
  }
  if (t.fontWeights.length) {
    lines.push(``);
    t.fontWeights.forEach((w) => lines.push(`  --font-weight-${weightName(w.value)}: ${w.value};`));
  }
  if (t.lineHeights.length) {
    lines.push(``, `  /* line-heights, sorted tight -> loose */`);
    t.lineHeights.forEach((v, i) => {
      if (i < LEAD_NAMES.length) lines.push(`  --leading-${LEAD_NAMES[i]}: ${v};`);
    });
  }
  if (t.letterSpacings.length) {
    lines.push(``, `  /* letter-spacing, sorted tight -> wide */`);
    t.letterSpacings.forEach((v, i) => {
      if (i < TRACK_NAMES.length) lines.push(`  --tracking-${TRACK_NAMES[i]}: ${v};`);
    });
  }
  const r = sortedRadii(t);
  if (r.length) {
    lines.push(``);
    r.forEach((x, i) => {
      const name = /9999|50%/.test(x.value) ? "full" : radiusName(i);
      lines.push(`  --radius-${name}: ${x.value};`);
    });
  }
  const sh = sortedShadows(t);
  if (sh.length) {
    lines.push(``, `  /* shadows, sorted by blur */`);
    sh.forEach((s, i) => lines.push(`  --shadow-${SHADOW_NAMES[i] || i}: ${s.value};`));
  }
  if (t.breakpoints.length) {
    lines.push(``);
    const names = ["sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"];
    t.breakpoints.forEach((b, i) => {
      if (i < names.length) lines.push(`  --breakpoint-${names[i]}: ${b / 16}rem;`);
    });
  }
  if (t.spacing.length) {
    lines.push(``, `  /* most-used spacing values on the source site (px): ${t.spacing.join(", ")} */`);
  }
  lines.push(`}`, ``);
  if (t.darkVars?.length) {
    lines.push(`/* dark-mode values mined from the source (native token names) */`);
    lines.push(`@media (prefers-color-scheme: dark) {`, `  :root {`);
    t.darkVars.forEach((d) => lines.push(`    --${d.name}: ${d.dark};`));
    lines.push(`  }`, `}`, ``);
  }
  return lines.join("\n");
}

function genCssVars(t, colors, roles, stacks) {
  const lines = [`:root {`];
  lines.push(`  /* palette (mined, ranked by usage) */`);
  for (const c of colors) lines.push(`  --color-${c.name}: ${c.hex};`);
  if (roles.length) {
    lines.push(``, `  /* inferred semantic roles */`);
    for (const r of roles) lines.push(`  --color-${r.role}: ${r.hex};`);
  }
  if (t.fonts.length) {
    lines.push(``, `  /* typography */`);
    t.fonts.forEach((f) => lines.push(`  --font-${slugFont(f.name)}: "${f.name}";`));
  }
  if (t.fontSizes.length) {
    lines.push(``, `  /* type scale, ascending */`);
    t.fontSizes.forEach((px, i) => lines.push(`  --text-${i + 1}: ${px / 16}rem;`));
  }
  if (t.fontWeights.length) {
    lines.push(``, `  /* font weights in use */`);
    t.fontWeights.forEach((w) => lines.push(`  --font-weight-${weightName(w.value)}: ${w.value};`));
  }
  if (t.lineHeights.length) {
    lines.push(``, `  /* line-heights, tight -> loose */`);
    t.lineHeights.forEach((v, i) => lines.push(`  --leading-${i + 1}: ${v};`));
  }
  if (t.letterSpacings.length) {
    lines.push(``, `  /* letter-spacing, tight -> wide */`);
    t.letterSpacings.forEach((v, i) => lines.push(`  --tracking-${i + 1}: ${v};`));
  }
  if (t.spacing.length) {
    lines.push(``, `  /* spacing, ascending */`);
    t.spacing.forEach((px, i) => lines.push(`  --space-${i + 1}: ${px}px;`));
  }
  const r = sortedRadii(t);
  if (r.length) {
    lines.push(``, `  /* radius, ascending */`);
    r.forEach((x, i) => {
      const name = /9999|50%/.test(x.value) ? "full" : radiusName(i);
      lines.push(`  --radius-${name}: ${x.value};`);
    });
  }
  const sh = sortedShadows(t);
  if (sh.length) {
    lines.push(``, `  /* shadows, sorted by blur */`);
    sh.forEach((s, i) => lines.push(`  --shadow-${SHADOW_NAMES[i] || i}: ${s.value};`));
  }
  lines.push(`}`, ``);
  if (t.darkVars?.length) {
    lines.push(`/* dark-mode values mined from the source (native token names) */`);
    lines.push(`@media (prefers-color-scheme: dark) {`, `  :root {`);
    t.darkVars.forEach((d) => lines.push(`    --${d.name}: ${d.dark};`));
    lines.push(`  }`, `}`, ``);
  }
  return lines.join("\n");
}

function genTokensJson(url, t, colors, roles, stacks) {
  const tokens = {
    $description: `Design tokens extracted from ${url}. Semantic entries are inferred from usage + luminance; all values are mined from live CSS.`,
    color: {},
    semantic: {},
    fontFamily: {},
    fontSize: {},
    fontWeight: {},
    lineHeight: {},
    letterSpacing: {},
    dimension: {},
    borderRadius: {},
    shadow: {},
  };
  for (const c of colors) tokens.color[c.name] = { $value: c.hex, $type: "color" };
  for (const r of roles)
    tokens.semantic[r.role] = { $value: r.hex, $type: "color", $description: `inferred: ${r.why}` };
  t.fonts.forEach((f) => {
    tokens.fontFamily[slugFont(f.name)] = { $value: f.name, $type: "fontFamily" };
  });
  t.fontSizes.forEach((px, i) => {
    tokens.fontSize[`size-${i + 1}`] = { $value: `${px / 16}rem`, $type: "dimension" };
  });
  t.fontWeights.forEach((w) => {
    tokens.fontWeight[weightName(w.value)] = { $value: w.value, $type: "fontWeight" };
  });
  t.lineHeights.forEach((v, i) => {
    tokens.lineHeight[`leading-${i + 1}`] = { $value: v, $type: "number" };
  });
  t.letterSpacings.forEach((v, i) => {
    tokens.letterSpacing[`tracking-${i + 1}`] = { $value: v, $type: "dimension" };
  });
  t.spacing.forEach((px, i) => {
    tokens.dimension[`space-${i + 1}`] = { $value: `${px}px`, $type: "dimension" };
  });
  sortedRadii(t).forEach((x, i) => {
    const name = /9999|50%/.test(x.value) ? "full" : radiusName(i);
    tokens.borderRadius[name] = { $value: x.value, $type: "dimension" };
  });
  sortedShadows(t).forEach((s, i) => {
    tokens.shadow[SHADOW_NAMES[i] || `shadow-${i + 1}`] = { $value: s.value, $type: "shadow" };
  });
  if (t.darkVars?.length) {
    tokens.dark = {};
    t.darkVars.forEach((d) => {
      tokens.dark[d.name] = {
        $value: d.dark,
        $type: /^(#|rgb|hsl|oklch|oklab|color\()/.test(d.dark) ? "color" : "string",
        ...(d.light ? { $description: `light-mode value: ${d.light}` } : {}),
      };
    });
  }
  for (const k of Object.keys(tokens))
    if (typeof tokens[k] === "object" && Object.keys(tokens[k]).length === 0) delete tokens[k];
  return JSON.stringify(tokens, null, 2);
}

// ---------- entry ----------

export async function extractDesign(rawUrl) {
  const url = assertSafeUrl(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  const html = await fetchText(url.href, PAGE_CAP);
  return extractFromHtml(html, url.href);
}

// Same pipeline, but the page HTML is supplied by the caller
// (e.g. a stealth browser fetch for bot-protected sites).
export async function extractFromHtml(html, href) {
  const url = new URL(href);
  const sheetUrls = stylesheetUrls(html, url.href);
  const sheets = await Promise.allSettled(sheetUrls.map((u) => fetchText(u, CSS_CAP)));
  const css = stripComments(
    [...inlineStyles(html), ...sheets.filter((s) => s.status === "fulfilled").map((s) => s.value)].join("\n")
  );
  if (css.trim().length < 50)
    throw new Error("Couldn't find any usable CSS on that page. The site may render styles entirely via JavaScript.");

  const t = mineTokens(css, html);
  if (!t.neutrals.length && !t.accents.length && !t.fonts.length)
    throw new Error("No design tokens could be extracted from this page.");

  return buildResult(url.href, t, sheetUrls.length);
}

// Rebuild all four artifacts from stored raw tokens (no network).
export function regenerateFromRaw(raw, href) {
  return buildResult(href, raw.tokens, raw.stylesheets);
}

function buildResult(href, rawT, stylesheetCount) {
  const t = normalizeTokens(rawT);
  const colors = nameColors(t);
  const roles = inferRoles(t, colors);
  const stacks = classifyFonts(t.fonts);

  return {
    url: href,
    title: t.title,
    raw: { tokens: t, stylesheets: stylesheetCount },
    summary: {
      colors: colors.map((c) => ({ name: c.name, hex: c.hex, group: c.group })),
      fonts: t.fonts.map((f) => f.name),
      themeGuess: t.themeGuess,
      stylesheets: stylesheetCount,
      nativeVarCount: t.nativeVars.length,
    },
    files: {
      "DESIGN.md": genDesignMd(href, t, colors, roles, stacks),
      "tailwind.css": genTailwind(t, colors, roles, stacks),
      "variables.css": genCssVars(t, colors, roles, stacks),
      "tokens.json": genTokensJson(href, t, colors, roles, stacks),
    },
  };
}
