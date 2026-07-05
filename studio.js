// "Your Design" studio engine. No LLM: artifacts are compiled deterministically
// from REAL design tokens (a ready design, a live extraction, or our defaults).
// The generated pages demonstrate the chosen system with its own values.

import fs from "node:fs";
import path from "node:path";
import { extractDesign, luminance, contrast } from "./extract.js";

const esc = (s) =>
  String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function themeFromTokens(t, name) {
  const dark = t.themeGuess === "dark-leaning";
  const neutrals = [...t.neutrals].sort((a, b) => luminance(b.hex) - luminance(a.hex)); // light -> dark
  const lightest = neutrals[0]?.hex || "#ffffff";
  const darkest = neutrals[neutrals.length - 1]?.hex || "#0a0a0a";
  const canvas = dark ? darkest : lightest;
  const ink = dark ? lightest : darkest;
  const mids = neutrals.slice(1, -1);
  const surface = mids.length ? (dark ? mids[mids.length - 1].hex : mids[0].hex) : canvas;
  const line =
    mids.map((m) => m.hex).find((h) => contrast(h, canvas) >= 1.2 && contrast(h, canvas) <= 3) ||
    surface;
  const muted =
    mids.map((m) => m.hex).find((h) => contrast(h, canvas) >= 4.5) || ink;
  const accent = t.accents?.[0]?.hex || ink;
  const accentInk = contrast("#ffffff", accent) >= contrast(ink, accent) ? "#ffffff" : ink;
  const font =
    t.fonts?.find((f) => !/(mono|code|courier|consolas)/i.test(f.name))?.name || "system-ui";
  const mono = t.fonts?.find((f) => /(mono|code|courier|consolas)/i.test(f.name))?.name || "ui-monospace";
  const finite = (t.radii || []).filter((r) => !/9999|50%/.test(r.value));
  const dom = [...finite].sort((a, b) => b.count - a.count)[0];
  const radius = dom ? Math.round(parseFloat(dom.value) * (dom.value.includes("rem") ? 16 : 1)) : 8;
  return { name, dark, canvas, ink, surface, line, muted, accent, accentInk, font, mono, radius };
}

const DEFAULT_THEME = {
  name: "Source Design",
  dark: true,
  canvas: "#0a0a0b", ink: "#f5f5f4", surface: "#141416", line: "#26262a",
  muted: "#8a8a8e", accent: "#22d3ee", accentInk: "#0a0a0b",
  font: "Space Grotesk", mono: "JetBrains Mono", radius: 8,
};

export async function resolveTheme(design) {
  if (design?.type === "ready" && design.slug) {
    const file = path.join(process.cwd(), "lib", "ready", `${design.slug}.json`);
    if (!/^[a-z0-9-]+$/.test(design.slug) || !fs.existsSync(file))
      throw new Error(`Unknown ready design '${design.slug}'.`);
    const rec = JSON.parse(fs.readFileSync(file, "utf8"));
    return themeFromTokens(rec.raw.tokens, rec.name);
  }
  if (design?.type === "url" && design.url) {
    const result = await extractDesign(design.url.trim());
    return themeFromTokens(
      result.raw.tokens,
      new URL(result.url).hostname.replace(/^www\./, "")
    );
  }
  return DEFAULT_THEME;
}

function baseCss(th) {
  return `
  :root { --canvas:${th.canvas}; --ink:${th.ink}; --surface:${th.surface}; --line:${th.line};
    --muted:${th.muted}; --accent:${th.accent}; --accent-ink:${th.accentInk}; --r:${th.radius}px; }
  * { box-sizing: border-box; margin: 0; }
  body { background: var(--canvas); color: var(--ink);
    font-family: "${th.font}", ui-sans-serif, system-ui, sans-serif; line-height: 1.5; }
  code, .mono { font-family: "${th.mono}", ui-monospace, monospace; }
  input, textarea, button, select { font-family: inherit; color: inherit; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
  .btn { display: inline-block; background: var(--accent); color: var(--accent-ink);
    padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: 600; border: 0; transition: all 0.2s ease; cursor: pointer; }
  .btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .muted { color: var(--muted); }
  input, textarea {
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  input:focus, textarea:focus {
    outline: none;
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 1px var(--accent);
  }
  .card {
    transition: border-color 0.2s ease, transform 0.2s ease;
  }
  .card:hover {
    border-color: var(--accent);
  }
  details.card {
    transition: border-color 0.2s ease;
  }
  details.card:hover {
    border-color: var(--accent);
  }
  summary {
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary::after {
    content: "→";
    color: var(--muted);
    font-family: system-ui, sans-serif;
    transition: transform 0.2s ease, color 0.2s ease;
  }
  details[open] summary::after {
    transform: rotate(90deg);
    color: var(--accent);
  }`;
}

function words(prompt, fallback) {
  const p = (prompt || "").trim();
  return p.length > 1 ? p : fallback;
}

function getStudioContent(prompt) {
  const p = (prompt || "").toLowerCase();
  
  // 1. Topic detection
  let topic = "saas";
  let topicName = "SaaS Dashboard";
  let features = [];
  let pricing = null;

  if (p.includes("coffee") || p.includes("tea") || p.includes("bean") || p.includes("brew") || p.includes("roast") || p.includes("subscription") || p.includes("cafe") || p.includes("drink")) {
    topic = "coffee";
    topicName = "Coffee Subscription";
    features = [
      { title: "Freshly Roasted", desc: "Small-batch roasted weekly and shipped within 24 hours of roasting." },
      { title: "Ethically Sourced", desc: "Direct-trade beans sourced responsibly from sustainable family farms." },
      { title: "Tailored to You", desc: "Choose your grind, flavor profile, and delivery frequency anytime." },
      { title: "Free Shipping", desc: "No-cost carbon-neutral delivery on every subscription order." },
      { title: "Cancel Anytime", desc: "Skip, pause, or adjust your coffee plan with zero penalty." },
      { title: "Exclusive Access", desc: "Priority access to rare micro-lots and limited-edition roasts." }
    ];
    pricing = {
      title: "Choose your coffee plan",
      tiers: [
        { name: "The Enthusiast", price: "18", period: "bag", desc: "Perfect for casual brewers.", features: ["1 x 250g bag/month", "Standard origin rotation", "Free grind selection", "Free shipping"] },
        { name: "The Barista", price: "32", period: "month", desc: "Best for daily coffee drinkers.", features: ["2 x 250g bags/month", "Premium single-origin beans", "Exclusive tasting guides", "Free shipping", "10% off gear store"] },
        { name: "The Roaster's Reserve", price: "55", period: "month", desc: "For true coffee connoisseurs.", features: ["3 x 250g rare microlot selections", "Q-Grader online chats", "Free shipping", "20% off gear store"] }
      ]
    };
  } else if (p.includes("fitness") || p.includes("gym") || p.includes("workout") || p.includes("trainer") || p.includes("health") || p.includes("yoga") || p.includes("wellness")) {
    topic = "fitness";
    topicName = "Fitness Portal";
    features = [
      { title: "Personalized Training", desc: "Custom workout regimes tailored to your exact fitness goals." },
      { title: "Nutritional Coaching", desc: "Meal plans designed by certified dieticians to support your workouts." },
      { title: "Progress Tracking", desc: "Track metrics, weight, reps, and benchmarks in our companion app." },
      { title: "Community Groups", desc: "Connect with local athletes and join group workout sessions." },
      { title: "Recovery Focus", desc: "Guided recovery, stretching, and mobility routines included." },
      { title: "24/7 Access", desc: "Premium members get round-the-clock secure keyless entry." }
    ];
    pricing = {
      title: "Simple fitness pricing",
      tiers: [
        { name: "Basic Membership", price: "29", period: "month", desc: "Access to gym floor.", features: ["Access to gym floor", "Standard locker rooms", "1 guest pass per month", "Mobile app access"] },
        { name: "Pro Athlete", price: "59", period: "month", desc: "Access to gym + classes.", features: ["Access to gym floor", "All group fitness classes", "1 coaching session/month", "Premium locker access", "Free towels"] },
        { name: "Elite Coach", price: "129", period: "month", desc: "Unlimited access & coaching.", features: ["Unlimited access & classes", "Weekly 1-on-1 coaching", "Custom nutrition plan", "Recovery zone access", "Merch package"] }
      ]
    };
  } else if (p.includes("course") || p.includes("learn") || p.includes("teach") || p.includes("school") || p.includes("academy") || p.includes("tutorial") || p.includes("education")) {
    topic = "education";
    topicName = "Learning Academy";
    features = [
      { title: "Expert Instructors", desc: "Learn from industry professionals with real-world field experience." },
      { title: "Hands-on Projects", desc: "Build a portfolio of real projects with direct code-review feedback." },
      { title: "Interactive Quizzes", desc: "Validate your learning with bite-sized quizzes after each lesson." },
      { title: "Lifetime Access", desc: "Study at your own pace with unlimited lifetime access to purchased courses." },
      { title: "Slack Community", desc: "Join 10k+ active students and mentors in our private learning hub." },
      { title: "Job Placement", desc: "Elite plans include interview prep and direct recruitment pipelines." }
    ];
    pricing = {
      title: "Pricing to start learning",
      tiers: [
        { name: "Single Course", price: "49", period: "course", desc: "Lifetime access to one course.", features: ["Access to 1 specific course", "Certificate of completion", "Community Q&A", "Source code files"] },
        { name: "All-Access Pass", price: "29", period: "month", desc: "Unlimited access to all courses.", features: ["All 100+ active courses", "Weekly live workshops", "Monthly project reviews", "Exclusive Discord channels"] },
        { name: "Mentorship Pro", price: "199", period: "month", desc: "1-on-1 dedicated mentorship.", features: ["All-Access Pass content", "Weekly 1-on-1 mentor calls", "Resume & portfolio reviews", "Direct job placement help"] }
      ]
    };
  } else if (p.includes("finance") || p.includes("crypto") || p.includes("pay") || p.includes("bank") || p.includes("wallet") || p.includes("fintech") || p.includes("invest")) {
    topic = "finance";
    topicName = "Fintech Platform";
    features = [
      { title: "Instant Transfers", desc: "Send and receive funds globally in under 2 seconds with zero fees." },
      { title: "Bank-Grade Security", desc: "Protected by AES-256 encryption and multi-signature authorization." },
      { title: "Smart Analytics", desc: "Auto-categorize transactions and track your monthly spending habits." },
      { title: "High Yield Savings", desc: "Earn up to 4.5% APY on idle cash balance with FDIC insurance." },
      { title: "Automated Trading", desc: "AI-driven rebalancing to maximize yield on asset portfolios." },
      { title: "Premium Cards", desc: "Physical aluminum, brass, or titanium laser-engraved cards." }
    ];
    pricing = {
      title: "Simple fintech tiers",
      tiers: [
        { name: "Lite Account", price: "0", period: "month", desc: "Standard digital banking.", features: ["Digital card", "Free domestic bank wires", "Basic spending analytics", "24/7 automated support"] },
        { name: "Premium Account", price: "9", period: "month", desc: "Sleek metal card, high APY.", features: ["Custom metal card", "Unlimited global transfers", "High-yield savings (4.5% APY)", "0.5% spent cashback", "Priority support"] },
        { name: "Elite Wealth", price: "25", period: "month", desc: "Dedicated financial advising.", features: ["Solid titanium card", "Free international wire deposits", "Dedicated advisor calls", "1.5% spent cashback", "Airport lounge access"] }
      ]
    };
  } else if (p.includes("portfolio") || p.includes("agency") || p.includes("creative") || p.includes("design") || p.includes("studio") || p.includes("marketing")) {
    topic = "agency";
    topicName = "Creative Studio";
    features = [
      { title: "UX/UI Design", desc: "Interactive, research-backed mobile apps and websites built for conversions." },
      { title: "Brand Systems", desc: "Distinct visual identities, logo guidelines, and custom asset libraries." },
      { title: "Web Development", desc: "Performance-first frontend builds using modern engineering practices." },
      { title: "Product Strategy", desc: "Workshops to define feature scope, roadmap, and go-to-market plan." },
      { title: "Custom Assets", desc: "Hand-crafted illustrations, icon systems, and motion branding elements." },
      { title: "Speedy Delivery", desc: "Reliable deliverables synced directly to your team's Figma dashboard." }
    ];
    pricing = {
      title: "Partner with our studio",
      tiers: [
        { name: "Growth Plan", price: "1,999", period: "month", desc: "For startups needing steady designs.", features: ["1 active request at a time", "Standard 3-day turnaround", "Unlimited revisions", "Slack channel communication"] },
        { name: "Scale Plan", price: "3,499", period: "month", desc: "Best for fast-growing companies.", features: ["2 active requests at a time", "Priority 24-48h turnaround", "Webflow/NextJS implementation", "Weekly progress sync calls"] },
        { name: "Dedicated Pod", price: "6,999", period: "month", desc: "Dedicated full-time resources.", features: ["1 full-time product designer", "1 full-time frontend dev", "Instant daily Slack updates", "Complete visual codebase ownership"] }
      ]
    };
  } else {
    // Default / SaaS
    topic = "saas";
    topicName = "SaaS Dashboard";
    features = [
      { title: "Fast by default", desc: "Under 50ms interaction latency with globally distributed edge rendering." },
      { title: "Built on real tokens", desc: "Standard W3C tokens sync automatically to Figma and codebases." },
      { title: "No vendor lock-in", desc: "Deploy plain HTML/CSS anywhere or export complete React components." },
      { title: "Works everywhere", desc: "Responsive rendering tested across all devices and screen viewports." },
      { title: "Honest pricing", desc: "Predictable tiers that scale linearly with your real traffic volume." },
      { title: "Ships today", desc: "One-click deployment pipelines that push updates live in seconds." }
    ];
    pricing = {
      title: "Pricing built to scale",
      tiers: [
        { name: "Starter", price: "0", period: "month", desc: "For hobbyists and early ideas.", features: ["1 active project", "Community support", "Standard build pipeline", "10k views/month"] },
        { name: "Pro", price: "19", period: "month", desc: "For scaling products and startups.", features: ["Unlimited active projects", "Priority email support", "Dedicated build workers", "100k views/month", "Custom domains"] },
        { name: "Team", price: "49", period: "month", desc: "For design and dev teams.", features: ["Everything in Pro", "Shared team workspaces", "Role-based permissions", "SSO integration", "1M views/month"] }
      ]
    };
  }

  // 2. Intent Detection
  const hasPricing = p.includes("pricing") || p.includes("subscription") || p.includes("plan") || p.includes("price") || p.includes("tier") || p.includes("cost") || p.includes("buy");

  return { topic, topicName, features, pricing, hasPricing };
}

function getStudioCopy(prompt) {
  const content = getStudioContent(prompt);
  const subject = prompt ? prompt.replace(/^(design|make|create|build|generate|show|give|render)\s+(me\s+)?(a\s+)?/i, "")
                                 .replace(/^(pricing\s+page\s+for\s+|landing\s+page\s+for\s+|website\s+for\s+|homepage\s+for\s+|page\s+for\s+)/i, "")
                                 .trim() : "";
  const displaySubject = subject ? (subject.charAt(0).toUpperCase() + subject.slice(1)) : "";

  let title = "A Product Worth Shipping";
  let subtitle = "Generated with extracted design tokens. Fully responsive and clean.";

  if (content.topic === "coffee") {
    title = content.hasPricing ? "Premium Coffee Subscription Plans" : "Freshly Roasted Coffee, Shipped Weekly";
    subtitle = content.hasPricing 
      ? "Select a flexible plan featuring small-batch beans roasted and shipped fresh weekly."
      : "Ethically sourced from sustainable family farms, locally roasted, and delivered straight to your door.";
  } else if (content.topic === "fitness") {
    title = content.hasPricing ? "Choose Your Fitness Membership Plan" : "Transform Your Peak Athletic Performance";
    subtitle = content.hasPricing
      ? "Unlock gym floor access, group training classes, and private coaching tailored to your lifestyle."
      : "Customized training regimes, certified nutritional advice, and smart tracking indicators.";
  } else if (content.topic === "education") {
    title = content.hasPricing ? "Interactive Learning Subscriptions" : "Master In-Demand Technical Skills Online";
    subtitle = content.hasPricing
      ? "Get instant access to single specialized workshops or sign up for our all-access pass."
      : "Learn from industry experts, build hands-on projects, and get mentor code reviews.";
  } else if (content.topic === "finance") {
    title = content.hasPricing ? "Simple, Transparent Account Pricing" : "Modern Digital Banking & Asset Portfolios";
    subtitle = content.hasPricing
      ? "Select a digital card tier and yield program account that fits your spending habits."
      : "Instant global money transfers, secure ledger storage, and high-yield savings plans.";
  } else if (content.topic === "agency") {
    title = content.hasPricing ? "Flexible Monthly Design Partner Tiers" : "We Design and Build Digital Products That Scale";
    subtitle = content.hasPricing
      ? "Predictable design partnerships to supercharge your startup's development roadmap."
      : "Full-service visual identity brand systems, UI/UX mockups, and NextJS development.";
  } else {
    // Default SaaS
    if (displaySubject) {
      title = content.hasPricing ? `${displaySubject} Plans & Pricing` : displaySubject;
      subtitle = `A premium page built using the system's extracted design tokens. Fully customizable.`;
    } else {
      title = "A Premium Product Built to Scale";
      subtitle = "Composed from live extracted design tokens. Clean, responsive, and performance-first.";
    }
  }

  return { title, subtitle, subject: displaySubject || content.topicName };
}

// ---------- templates ----------

function prototypeHtml(th, prompt, effort) {
  const content = getStudioContent(prompt);
  const copy = getStudioCopy(prompt);
  const title = esc(copy.title);
  const subtitle = esc(copy.subtitle);
  
  let sectionHtml = "";
  if (content.hasPricing && content.pricing) {
    const cardLimit = effort === "low" ? 1 : effort === "medium" ? 2 : 3;
    const cards = content.pricing.tiers.slice(0, cardLimit).map((tier, i) => `
      <div style="border:1px solid ${i === 1 ? "var(--accent)" : "var(--line)"};border-radius:var(--r);padding:32px;background:var(--surface);display:flex;flex-direction:column;justify-content:space-between">
        <div>
          <h3 style="font-size:20px;margin-bottom:8px">${esc(tier.name)}</h3>
          <p class="muted" style="font-size:14px;margin-bottom:16px">${esc(tier.desc)}</p>
          <div style="font-size:36px;font-weight:700;margin-bottom:24px">$${esc(tier.price)}<span style="font-size:14px;font-weight:400" class="muted">/${esc(tier.period)}</span></div>
          <ul style="list-style:none;padding:0;margin:0 0 24px;display:grid;gap:8px;font-size:14px">
            ${tier.features.map(f => `<li class="muted">✓ ${esc(f)}</li>`).join("")}
          </ul>
        </div>
        <a class="btn" href="#cta" style="width:100%;text-align:center;padding:10px 16px;font-size:14px;background:${i === 1 ? "var(--accent)" : "transparent"};color:${i === 1 ? "var(--accent-ink)" : "var(--ink)"};border:1px solid var(--line)">Select ${esc(tier.name)}</a>
      </div>
    `).join("");
    sectionHtml = `
      <div style="text-align:center;margin-bottom:48px">
        <h2 style="font-size:32px">${esc(content.pricing.title)}</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px">${cards}</div>`;
  } else {
    const featsLimit = effort === "low" ? 3 : effort === "medium" ? 4 : 6;
    const feats = content.features.slice(0, featsLimit).map((f) => `
      <div style="border:1px solid var(--line);border-radius:var(--r);padding:24px;background:var(--surface)">
        <h3 style="margin-bottom:8px">${esc(f.title)}</h3>
        <p class="muted" style="font-size:14px">${esc(f.desc)}</p>
      </div>
    `).join("");
    sectionHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">${feats}</div>`;
  }

  const extra = effort === "high" ? `
  <section class="wrap" style="padding:64px 24px;border-top:1px solid var(--line)">
    <blockquote style="font-size:22px;max-width:36ch">"Every value on this page is a real token mined from ${esc(th.name)}."</blockquote>
    <p class="muted" style="margin-top:12px">Source Design, design system extractor</p>
  </section>` : "";

  const ctaText = content.hasPricing ? "Choose Plan" : "Get started";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${baseCss(th)}</style></head><body>
<nav style="border-bottom:1px solid var(--line)"><div class="wrap" style="display:flex;align-items:center;gap:24px;height:64px">
  <strong>${esc(th.name)}</strong><span class="muted" style="margin-left:auto;font-size:14px">${esc(content.topicName)}</span>
  <a class="btn" href="#cta" style="padding:8px 18px;font-size:14px">${ctaText}</a></div></nav>
<header class="wrap" style="padding:96px 24px 64px;max-width:880px">
  <h1 style="font-size:clamp(36px,6vw,64px);line-height:1.05;letter-spacing:-0.02em">${title}</h1>
  <p class="muted" style="margin-top:20px;font-size:18px;max-width:52ch">${subtitle}</p>
  <a class="btn" href="#cta" style="margin-top:28px">${ctaText}</a></header>
<section class="wrap" style="padding:32px 24px 80px">${sectionHtml}</section>${extra}
<footer id="cta" style="border-top:1px solid var(--line)"><div class="wrap" style="padding:64px 24px;text-align:center">
  <h2 style="font-size:28px">Ready when you are.</h2><a class="btn" style="margin-top:20px" href="#">Start now</a></div></footer>
</body></html>`;
}

function wireframeHtml(th, prompt, effort) {
  const content = getStudioContent(prompt);
  const copy = getStudioCopy(prompt);
  const title = esc(copy.title);
  const gray = { ...th, accent: th.muted, accentInk: th.canvas };
  const n = effort === "low" ? 2 : effort === "medium" ? 4 : 6;

  let mainSection = "";
  if (content.hasPricing && content.pricing) {
    const tiers = content.pricing.tiers.map((t) => `
      <div style="border:2px dashed var(--line);border-radius:var(--r);padding:24px;text-align:center" class="muted mono">
        <div>[ ${esc(t.name)} ]</div>
        <div style="margin-top:8px">$ ${esc(t.price)}</div>
        <div style="margin-top:16px;font-size:12px">${t.features.map(f => `· ${esc(f)}`).join("<br>")}</div>
      </div>
    `).join("");
    mainSection = `
      <div style="text-align:center;margin:32px 0 16px" class="mono">[ Pricing Grid: ${esc(content.pricing.title)} ]</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">${tiers}</div>`;
  } else {
    const boxes = Array.from({ length: n }, (_, i) =>
      `<div style="border:2px dashed var(--line);border-radius:var(--r);padding:32px;text-align:center" class="muted mono">block ${i + 1}: ${esc(content.features[i]?.title || "feature")}</div>`
    ).join("");
    mainSection = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-top:16px">${boxes}</div>`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wireframe — ${title}</title><style>${baseCss(gray)}</style></head><body>
<div class="wrap" style="padding:40px 24px">
  <div style="border:2px dashed var(--line);border-radius:var(--r);padding:16px 24px;display:flex;justify-content:space-between" class="mono muted"><span>logo [ ${esc(content.topicName)} ]</span><span>nav · nav · nav</span></div>
  <div style="border:2px dashed var(--line);border-radius:var(--r);padding:80px 24px;margin-top:16px;text-align:center">
    <div style="font-size:28px">${title}</div>
    <div class="muted mono" style="margin-top:8px">subcopy · cta</div></div>
  ${mainSection}
  <div style="border:2px dashed var(--line);border-radius:var(--r);padding:24px;margin-top:16px;text-align:center" class="mono muted">footer</div>
</div></body></html>`;
}

function documentHtml(th, prompt, effort) {
  const content = getStudioContent(prompt);
  const copy = getStudioCopy(prompt);
  const title = esc(copy.title);
  const subtitle = esc(copy.subtitle);
  
  let specs = [];
  if (content.hasPricing && content.pricing) {
    specs = content.pricing.tiers.map(t => [
      t.name,
      `Price: $${t.price}/${t.period}. Features: ${t.features.join(", ")}.`
    ]);
  } else {
    const limit = effort === "low" ? 2 : effort === "medium" ? 3 : 4;
    specs = content.features.slice(0, limit).map(f => [
      f.title,
      f.desc
    ]);
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${baseCss(th)}
  h2 { margin: 40px 0 8px; font-size: 20px; } p { max-width: 65ch; }</style></head><body>
<article class="wrap" style="max-width:760px;padding:80px 24px">
  <p class="mono muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.12em">${esc(th.name)} · document</p>
  <h1 style="font-size:40px;margin-top:12px;letter-spacing:-0.02em">${title}</h1>
  <p class="muted" style="margin-top:16px;font-size:18px">${subtitle}</p>
  <hr style="border:0;border-top:1px solid var(--line);margin:40px 0">
  ${specs.map(([h, b]) => `<h2>${esc(h)}</h2><p class="muted">${esc(b)}</p>`).join("")}
</article></body></html>`;
}

function slidesHtml(th, prompt, effort) {
  const content = getStudioContent(prompt);
  const copy = getStudioCopy(prompt);
  const title = esc(copy.title);
  const subtitle = esc(copy.subtitle);
  const count = effort === "low" ? 4 : effort === "medium" ? 6 : 8;

  let bodySlides = [];
  if (content.hasPricing && content.pricing) {
    bodySlides = [
      `<h2>Pricing Tiers</h2><p class="muted" style="margin-top:16px">Tiers: ${content.pricing.tiers.map(t => `${t.name} ($${t.price}/${t.period})`).join(", ")}.</p>`,
      `<h2>${content.pricing.tiers[0].name}</h2><p class="muted" style="margin-top:16px">${content.pricing.tiers[0].desc}<br>Features: ${content.pricing.tiers[0].features.join(", ")}.</p>`,
      `<h2>${content.pricing.tiers[1].name}</h2><p class="muted" style="margin-top:16px">${content.pricing.tiers[1].desc}<br>Features: ${content.pricing.tiers[1].features.join(", ")}.</p>`,
      `<h2>Why subscribe?</h2><p class="muted" style="margin-top:16px">${content.features[0].title}: ${content.features[0].desc}</p>`
    ];
  } else {
    bodySlides = content.features.slice(0, count - 2).map(f => 
      `<h2>${esc(f.title)}</h2><p class="muted" style="margin-top:16px">${esc(f.desc)}</p>
`
    );
  }

  const chips = `<div style="display:flex;gap:8px;justify-content:center;margin-top:24px">
    ${[th.canvas, th.surface, th.line, th.muted, th.accent].map((c) => `<span style="width:40px;height:40px;border-radius:var(--r);border:1px solid var(--line);background:${c}"></span>`).join("")}</div>`;

  const slides = [
    `<h1 style="font-size:clamp(40px,7vw,72px);letter-spacing:-0.02em">${title}</h1><p class="muted" style="margin-top:16px">${subtitle}</p>`,
    ...bodySlides.slice(0, count - 2),
    `<h2 style="font-size:40px">Fin.</h2><p class="muted" style="margin-top:12px">Compiled by Source Design's studio from extracted tokens.</p>`,
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${baseCss(th)}
  .slide { min-height: 100vh; display: none; align-items: center; justify-content: center; text-align: center; padding: 48px; }
  .slide.on { display: flex; } .slide > div { max-width: 760px; }
  .hud { position: fixed; bottom: 16px; right: 20px; font-size: 12px; }</style></head><body>
${slides.map((s, i) => `<section class="slide${i === 0 ? " on" : ""}"><div>${s}</div></section>`).join("")}
<div class="hud mono muted"><span id="n">1</span>/${slides.length}</div>
<script>
let i = 0; const S = document.querySelectorAll('.slide'), N = document.getElementById('n');
function go(d){ i = Math.min(S.length-1, Math.max(0, i+d)); S.forEach((s,k)=>s.classList.toggle('on',k===i)); N.textContent = i+1; }
addEventListener('keydown', e => { if(e.key==='ArrowRight'||e.key===' ') go(1); if(e.key==='ArrowLeft') go(-1); });
addEventListener('click', () => go(1));
</script></body></html>`;
}

function animationHtml(th, prompt, effort) {
  const content = getStudioContent(prompt);
  const copy = getStudioCopy(prompt);
  const title = esc(copy.title);
  const subtitle = esc(copy.subtitle);
  const blobs = effort === "low" ? 1 : effort === "medium" ? 2 : 3;

  let cards = [];
  if (content.hasPricing && content.pricing) {
    cards = content.pricing.tiers.map(t => [t.name, `$${t.price}/${t.period}`]);
  } else {
    cards = content.features.slice(0, 3).map(f => [f.title, f.desc]);
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>${baseCss(th)}
  @keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
  @keyframes drift { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,-30px) scale(1.15); } 100% { transform: translate(0,0) scale(1); } }
  @keyframes slide { from { transform: translateX(0); } to { transform: translateX(-50%); } }
  .hero > * { animation: rise .7s cubic-bezier(.23,1,.32,1) both; }
  .hero > *:nth-child(2) { animation-delay: .12s; } .hero > *:nth-child(3) { animation-delay: .24s; }
  .blob { position: fixed; border-radius: 50%; filter: blur(80px); opacity: .22; background: var(--accent); animation: drift 14s ease-in-out infinite; pointer-events: none; }
  .marquee { overflow: hidden; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .marquee > div { display: inline-flex; gap: 48px; padding: 16px 0; white-space: nowrap; animation: slide 18s linear infinite; }
  .card { border: 1px solid var(--line); background: var(--surface); border-radius: var(--r); padding: 28px; opacity: 0; transform: translateY(20px); transition: all .6s cubic-bezier(.23,1,.32,1); }
  .card.in { opacity: 1; transform: none; }
  @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } .card { opacity: 1; transform: none; } }</style></head><body>
${Array.from({ length: blobs }, (_, i) => `<div class="blob" style="width:${280 + i * 120}px;height:${280 + i * 120}px;${i % 2 ? "right" : "left"}:${8 + i * 10}%;top:${20 + i * 22}%;animation-delay:${i * 2}s"></div>`).join("")}
<main class="wrap hero" style="padding:120px 24px 80px;position:relative">
  <h1 style="font-size:clamp(40px,7vw,72px);letter-spacing:-0.02em;max-width:16ch">${title}</h1>
  <p class="muted" style="margin-top:20px;font-size:18px;max-width:48ch">${subtitle}</p>
  <a class="btn" style="margin-top:28px" href="#more">See details</a></main>
<div class="marquee mono muted"><div>${Array(6).fill(`${title} · ${th.accent} · ${esc(th.font)} ·`).join(" ")}</div></div>
<section id="more" class="wrap" style="padding:80px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
  ${cards.map(([h, b]) => `<div class="card"><h3>${esc(h)}</h3><p class="muted" style="margin-top:8px;font-size:14px">${esc(b)}</p></div>`).join("")}
</section>
<script>
const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .3 });
document.querySelectorAll('.card').forEach(c => io.observe(c));
</script></body></html>`;
}

function websiteHtml(th, prompt, effort) {
  const content = getStudioContent(prompt);
  const copy = getStudioCopy(prompt);
  const brand = esc(copy.subject);
  const title = esc(copy.title);
  const subtitle = esc(copy.subtitle);
  const pageIds =
    effort === "low"
      ? ["home", "contact"]
      : effort === "medium"
        ? ["home", "features", "pricing", "contact"]
        : ["home", "features", "pricing", "about", "faq", "contact"];
  const labels = { home: "Home", features: "Features", pricing: "Pricing", about: "About", faq: "FAQ", contact: "Contact" };

  const nav = pageIds
    .map((p) => `<a href="#/${p}" data-nav="${p}" class="navlink">${labels[p]}</a>`)
    .join("");

  const tiers = (content.pricing?.tiers || [
    { name: "Starter", price: "0", period: "month", desc: "", features: ["One project", "Community support"] },
    { name: "Pro", price: "19", period: "month", desc: "", features: ["Unlimited projects", "Priority support", "Exports"] },
    { name: "Team", price: "49", period: "month", desc: "", features: ["Everything in Pro", "Shared workspaces", "SSO"] }
  ]).map((tier, i) => `
    <div class="card" style="${i === 1 ? "border-color:var(--accent)" : ""}">
      <h3>${esc(tier.name)}</h3>
      <p style="font-size:36px;margin-top:8px">$${esc(tier.price)}<span class="muted" style="font-size:14px">/${esc(tier.period)}</span></p>
      <ul class="muted" style="margin:16px 0 0 18px;font-size:14px;display:grid;gap:6px">${tier.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <a class="btn" href="#/contact" style="margin-top:20px;width:100%;text-align:center">Choose ${esc(tier.name)}</a>
    </div>`).join("");

  const pages = {
    home: `<header style="padding:96px 0 64px">
      <h1 style="font-size:clamp(36px,6vw,64px);line-height:1.05;letter-spacing:-0.02em;max-width:18ch">${title}</h1>
      <p class="muted" style="margin-top:20px;font-size:18px;max-width:52ch">${subtitle}</p>
      <div style="margin-top:28px;display:flex;gap:12px;flex-wrap:wrap">
        <a class="btn" href="#/${pageIds.includes("pricing") ? "pricing" : "contact"}">${pageIds.includes("pricing") ? "See pricing" : "Get in touch"}</a>
        ${pageIds.includes("features") ? `<a class="btn ghost" href="#/features">Explore features</a>` : ""}
      </div></header>
      <section style="padding:16px 0 80px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px">
        ${content.features.slice(0, 3).map((f) => `<div class="card"><h3>${esc(f.title)}</h3><p class="muted" style="margin-top:8px;font-size:14px">${esc(f.desc)}</p></div>`).join("")}
      </section>`,
    features: `<header style="padding:72px 0 40px"><h1 style="font-size:40px">Features</h1>
      <p class="muted" style="margin-top:12px;max-width:52ch">Laid out on ${esc(th.name)}'s grid.</p></header>
      <section style="padding:0 0 80px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
        ${content.features.map((f) => `<div class="card"><h3>${esc(f.title)}</h3><p class="muted" style="margin-top:8px;font-size:14px">${esc(f.desc)}</p></div>`).join("")}
      </section>`,
    pricing: `<header style="padding:72px 0 40px"><h1 style="font-size:40px">Pricing</h1>
      <p class="muted" style="margin-top:12px">Three tiers. The buttons route to Contact.</p></header>
      <section style="padding:0 0 80px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">${tiers}</section>`,
    about: `<header style="padding:72px 0 24px"><h1 style="font-size:40px">About</h1></header>
      <section style="padding:0 0 80px;max-width:60ch">
        <p class="muted" style="font-size:17px;line-height:1.6">This site was compiled by Source Design's studio from <span style="color:var(--accent);font-weight:600">${esc(th.name)}</span>'s real design tokens: a ${th.dark ? "dark" : "light"} canvas (${th.canvas}), ${esc(th.font)} for type, and <span style="color:var(--accent);font-weight:600">${th.accent}</span> carrying every action.</p>
        <p class="muted" style="font-size:17px;line-height:1.6;margin-top:16px">Designed for <span style="color:var(--accent);font-weight:600">${brand}</span>.</p>
        <div class="card" style="margin-top:32px;border-left:4px solid var(--accent);padding:24px;background:var(--surface)">
          <h3 style="font-size:16px;font-weight:600;color:var(--accent);margin-bottom:16px">Extracted Design System</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
            <div><span class="muted" style="font-size:12px;">Active Brand</span><div style="font-size:14px;font-weight:500;margin-top:4px;">${brand}</div></div>
            <div><span class="muted" style="font-size:12px;">Accent Token</span><div style="font-size:14px;font-weight:500;color:var(--accent);margin-top:4px;">${th.accent}</div></div>
            <div><span class="muted" style="font-size:12px;">Primary Font</span><div style="font-size:14px;font-weight:500;margin-top:4px;">${esc(th.font)}</div></div>
            <div><span class="muted" style="font-size:12px;">Border Radius</span><div style="font-size:14px;font-weight:500;margin-top:4px;">${th.radius}px</div></div>
          </div>
        </div>
      </section>`,
    faq: `<header style="padding:72px 0 24px"><h1 style="font-size:40px">FAQ</h1></header>
      <section style="padding:0 0 80px;max-width:64ch;display:grid;gap:12px">
        ${[["Does the navigation really work?", "Yes — an internal router switches pages; no server needed."], ["Can I use this file as-is?", "It's self-contained HTML/CSS/JS. Open it anywhere."], ["Where do the colors come from?", `Extracted from ${esc(th.name)}'s live CSS, ranked by usage.`], ["Can I change the design system?", "Pick another system in the studio and send again."]].map(([q, a]) => `<details class="card" style="padding:16px 20px;cursor:pointer"><summary style="font-weight:600;user-select:none">${q}</summary><p class="muted" style="margin-top:10px;font-size:14px;line-height:1.5">${a}</p></details>`).join("")}
      </section>`,
    contact: `<header style="padding:72px 0 24px"><h1 style="font-size:40px">Contact</h1>
      <p class="muted" style="margin-top:12px">Client-side validation, success state included.</p></header>
      <section style="padding:0 0 80px;max-width:480px">
        <form id="cf" novalidate style="display:grid;gap:14px">
          <label style="display:grid;gap:6px;font-size:14px">Name<input name="name" required style="height:42px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);color:var(--ink)"></label>
          <label style="display:grid;gap:6px;font-size:14px">Email<input name="email" type="email" required style="height:42px;padding:0 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);color:var(--ink)"></label>
          <label style="display:grid;gap:6px;font-size:14px">Message<textarea name="message" rows="4" required style="padding:10px 12px;border:1px solid var(--line);border-radius:var(--r);background:var(--surface);color:var(--ink);font-family:inherit"></textarea></label>
          <p id="cf-err" class="muted" style="display:none;font-size:13px"></p>
          <button class="btn" type="button" id="cf-send">Send message</button>
        </form>
        <p id="cf-ok" style="display:none;font-size:17px">Message sent. (Demo form — nothing left this page.)</p>
      </section>`,
  };

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${brand}</title><style>${baseCss(th)}
  .navlink { color: var(--muted); text-decoration: none; font-size: 14px; padding: 4px 2px; }
  .navlink.on { color: var(--accent); }
  .btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
  .card { border: 1px solid var(--line); background: var(--surface); border-radius:var(--r); padding: 24px; }
  [data-page] { display: none; } [data-page].on { display: block; }</style></head><body>
<nav style="border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--canvas);z-index:100"><div class="wrap" style="display:flex;align-items:center;gap:20px;height:64px">
  <a href="#/home" style="color:var(--ink);text-decoration:none;font-weight:700">${brand}</a>
  <div style="margin-left:auto;display:flex;gap:18px;flex-wrap:wrap">${nav}</div></div></nav>
${pageIds.map((p) => `<main data-page="${p}"${p === "home" ? ` class="on"` : ""}><div class="wrap">${pages[p]}</div></main>`).join("")}
<footer style="border-top:1px solid var(--line)"><div class="wrap" style="padding:24px;display:flex;justify-content:space-between;flex-wrap:gap" class="muted">
  <span class="muted" style="font-size:13px">${brand}</span><span class="muted mono" style="font-size:12px">tokens: ${esc(th.name)}</span></div></footer>
<script>
(function () {
  var pages = document.querySelectorAll("[data-page]");
  var links = document.querySelectorAll("[data-nav]");
  function show(id) {
    var found = false;
    pages.forEach(function (p) { var on = p.getAttribute("data-page") === id; p.classList.toggle("on", on); if (on) found = true; });
    if (!found) return;
    links.forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-nav") === id); });
    window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("#/") === 0) { e.preventDefault(); show(href.slice(2)); }
  });
  show("home");
  var send = document.getElementById("cf-send");
  if (send) send.addEventListener("click", function () {
    var f = document.getElementById("cf");
    var err = document.getElementById("cf-err");
    var name = f.name.value.trim(), email = f.email.value.trim(), msg = f.message.value.trim();
    if (!name || !email || !msg) { err.style.display = "block"; err.textContent = "All fields are required."; return; }
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) { err.style.display = "block"; err.textContent = "That email doesn't look right."; return; }
    f.style.display = "none";
    document.getElementById("cf-ok").style.display = "block";
  });
})();
</script></body></html>`;
}

const TEMPLATES = {
  website: { build: websiteHtml, label: "multi-page website" },
  prototype: { build: prototypeHtml, label: "prototype" },
  wireframe: { build: wireframeHtml, label: "wireframe" },
  document: { build: documentHtml, label: "document" },
  slides: { build: slidesHtml, label: "slide deck" },
  animation: { build: animationHtml, label: "animated page" },
};

// Inside a srcDoc iframe, relative hrefs resolve against the PARENT page's URL,
// so a plain href="#cta" would navigate the canvas to the real site. This guard
// keeps every link inside the artifact: anchors scroll, demo links stay inert.
const LINK_GUARD = `<script>
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest("a");
  if (!a) return;
  var href = a.getAttribute("href") || "";
  if (href.indexOf("#/") === 0) return; // in-artifact router link, the page handles it
  if (href.charAt(0) === "#") {
    e.preventDefault();
    if (href.length > 1) {
      try {
        var t = document.querySelector(href);
        if (t) t.scrollIntoView({ behavior: "smooth" });
      } catch (_) {}
    }
  } else if (!/^https?:/i.test(href)) {
    e.preventDefault(); // demo link — nowhere to go
  }
});
document.addEventListener("submit", function (e) {
  e.preventDefault(); // prevent form submissions from navigating/reloading
});
</script>`;

export const TEMPLATE_IDS = Object.keys(TEMPLATES);

export async function buildArtifact({ prompt, template, effort, design, version }) {
  const th = await resolveTheme(design);
  const t = TEMPLATES[template] || TEMPLATES.prototype;
  const html = t.build(th, prompt, effort || "medium").replace("</body>", `${LINK_GUARD}</body>`);
  const reply =
    `Built a ${t.label} from "${words(prompt, "blank brief")}" using ${th.name}'s tokens — ` +
    `accent ${th.accent}, ${th.font}, ${th.dark ? "dark" : "light"} canvas ${th.canvas}, radius ${th.radius}px. ` +
    `Effort ${effort || "medium"}. Change the model, template, or design system and send again to rebuild.`;
  return { reply, html, fileName: `v${version || 1}.html`, systemName: th.name };
}
