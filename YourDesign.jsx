"use client";

import { useEffect, useRef, useState } from "react";
import SiteHeader from "./SiteHeader";
import ready from "../lib/ready/index.json";
import BounceCards from "./ui/BounceCards";

const MODELS = [
  { id: "design-5", label: "Design 5", tag: "For full websites & prototypes", templates: ["website", "prototype", "wireframe", "document"] },
  { id: "slides-1", label: "Slides 1.0", tag: "For decks & talks", templates: ["slides"] },
  { id: "animator-3-5", label: "Animator 3.5", tag: "For motion-heavy pages", templates: ["animation"] },
];
const TEMPLATES = [
  { id: "website", label: "Website", model: "design-5" },
  { id: "prototype", label: "Prototype", model: "design-5" },
  { id: "slides", label: "Slides", model: "slides-1" },
  { id: "document", label: "Document", model: "design-5" },
  { id: "wireframe", label: "Wireframe", model: "design-5" },
  { id: "animation", label: "Animation", model: "animator-3-5" },
];
const EFFORTS = ["low", "medium", "high"];

const AI_PROVIDERS = [
  { id: "ollama", label: "Ollama", tag: "Free · runs locally", needsKey: false },
  { id: "google", label: "Google Gemini", tag: "gemini-2.5-flash", needsKey: true, placeholder: "AIza…" },
  { id: "openai", label: "OpenAI", tag: "gpt-4o-mini", needsKey: true, placeholder: "sk-…" },
  { id: "anthropic", label: "Anthropic", tag: "claude-sonnet-4", needsKey: true, placeholder: "sk-ant-…" },
];

const OLLAMA_SYSTEM_PROMPT = `You are Design 5, an expert web designer and frontend engineer. You create stunning, production-quality single-page websites from user briefs.

## Your Output Format

You MUST follow this exact structure. Output each section with its delimiter tags:

### Step 1: Think about the design
Wrap your reasoning in [THINKING] and [/THINKING] tags.
Reason about: color usage, typography hierarchy, spacing rhythm, layout structure, which sections to include, visual effects that fit the brief, and responsive behavior.
Keep this concise (3-6 sentences).

### Step 2: Create a plan
Wrap your plan in [PLAN] and [/PLAN] tags.
List 6-10 specific implementation tasks as a numbered list.

### Step 3: Write the code
Wrap your complete HTML file in [CODE] and [/CODE] tags.
Rules:
- Output a SINGLE self-contained HTML file with ALL CSS inline in a <style> tag and ALL JS inline in a <script> tag
- Make it visually STUNNING — use gradients, shadows, smooth transitions, hover effects
- Include real, plausible content (not lorem ipsum)
- Make it fully responsive
- Use semantic HTML5 elements
- Include subtle animations
- Do NOT use external CDNs or imports
- Do NOT include placeholder comments — write the actual complete code

## Critical Rules
- NEVER output partial code or placeholders
- ALWAYS output all three sections in order: [THINKING], [PLAN], [CODE]
- The [CODE] section must be a complete, working HTML document
- Make the design premium and polished`;

/** Parse a stream of NDJSON events and call handlers */
function parseNDJSON(buffer, handlers) {
  const lines = buffer.split("\n");
  const remainder = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      handlers(event);
    } catch {}
  }
  return remainder;
}

/** Parse Ollama's streaming response and extract our structured phases */
function parseOllamaChunks(fullText) {
  const result = { thinking: null, plan: null, codeHtml: null };
  const thinkStart = fullText.indexOf("[THINKING]");
  const thinkEnd = fullText.indexOf("[/THINKING]");
  if (thinkStart !== -1) {
    result.thinking = fullText.slice(thinkStart + 10, thinkEnd !== -1 ? thinkEnd : undefined).trim();
  }
  const planStart = fullText.indexOf("[PLAN]");
  const planEnd = fullText.indexOf("[/PLAN]");
  if (planStart !== -1 && planEnd !== -1) {
    result.plan = fullText.slice(planStart + 6, planEnd).trim()
      .split("\n")
      .map(l => l.replace(/^\d+\.\s*/, "").trim())
      .filter(l => l.length > 0);
  }
  const codeStart = fullText.indexOf("[CODE]");
  const codeEnd = fullText.indexOf("[/CODE]");
  if (codeStart !== -1 && codeEnd !== -1) {
    result.codeHtml = fullText.slice(codeStart + 6, codeEnd).trim();
  }
  return result;
}

function estimateProgress(code) {
  let p = 0;
  if (code.includes(":root") || code.includes("--")) p = 1;
  if (code.includes("<style") || code.includes("font-family")) p = 2;
  if (code.includes("<nav") || code.includes("<header")) p = 3;
  if (code.includes("<h1") || code.includes("hero")) p = 4;
  if (code.includes("grid") || code.includes("card")) p = 5;
  if (code.includes("pricing") || code.includes("section")) p = 6;
  if (code.includes("<footer")) p = 7;
  if (code.includes("hover") || code.includes("transition")) p = 8;
  if (code.includes("@media") || code.includes("responsive")) p = 9;
  return p;
}

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

function guardHtmlClient(html) {
  const code = html.trim();
  if (code.includes("</body>")) {
    return code.replace("</body>", `${LINK_GUARD}</body>`);
  }
  return `${code}${LINK_GUARD}`;
}

function TemplateGlyph({ id }) {
  const stroke = "var(--color-fog)";
  const common = { fill: "none", stroke, strokeWidth: 4 };
  return (
    <svg viewBox="0 0 64 48" className="w-12 h-9" aria-hidden="true">
      {id === "website" && (<><rect x="6" y="6" width="52" height="36" rx="3" {...common} /><line x1="6" y1="14" x2="58" y2="14" {...common} /><circle cx="12" cy="10" r="1.5" fill={stroke} stroke="none" /><circle cx="18" cy="10" r="1.5" fill={stroke} stroke="none" /><rect x="12" y="20" width="18" height="16" {...common} /><rect x="36" y="20" width="16" height="4" fill={stroke} stroke="none" /><rect x="36" y="28" width="12" height="4" fill={stroke} stroke="none" /></>)}
      {id === "prototype" && (<><rect x="6" y="6" width="52" height="36" rx="3" {...common} /><line x1="6" y1="16" x2="58" y2="16" {...common} /><rect x="12" y="22" width="20" height="4" fill={stroke} stroke="none" /><rect x="12" y="30" width="14" height="4" fill={stroke} stroke="none" /></>)}
      {id === "slides" && (<><rect x="6" y="10" width="34" height="24" rx="2" {...common} /><rect x="26" y="18" width="32" height="22" rx="2" fill="var(--color-surface)" stroke={stroke} strokeWidth="4" /></>)}
      {id === "document" && (<><rect x="16" y="4" width="32" height="40" rx="2" {...common} /><line x1="22" y1="14" x2="42" y2="14" {...common} /><line x1="22" y1="22" x2="42" y2="22" {...common} /><line x1="22" y1="30" x2="36" y2="30" {...common} /></>)}
      {id === "wireframe" && (<><rect x="6" y="6" width="52" height="36" rx="2" strokeDasharray="5 4" {...common} /><line x1="6" y1="16" x2="58" y2="16" strokeDasharray="5 4" {...common} /><rect x="12" y="22" width="16" height="14" strokeDasharray="5 4" {...common} /></>)}
      {id === "animation" && (<><rect x="6" y="6" width="52" height="36" rx="3" {...common} /><polygon points="27,16 42,24 27,32" fill={stroke} stroke="none" /></>)}
    </svg>
  );
}

function Menu({ open, onClose, children, align = "left", width = "w-64" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className={`absolute bottom-full mb-2 ${align === "right" ? "right-0" : "left-0"} ${width} max-h-80 overflow-y-auto border border-line bg-surface z-30 py-1`}>
      {children}
    </div>
  );
}

function Chip({ label, value, onClick, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press px-3 py-1.5 border rounded-md text-left transition-colors ${active ? "border-cyan" : "border-line hover:border-fog"} bg-void`}
    >
      <span className="block text-[10px] font-mono uppercase tracking-[0.1em] text-fog">{label} ⌄</span>
      <span className="block text-xs text-snow mt-0.5 max-w-[140px] truncate">{value}</span>
    </button>
  );
}

export default function YourDesign() {
  const [view, setView] = useState("landing");
  const [prompt, setPrompt] = useState("");
  const [template, setTemplate] = useState("prototype");
  const [model, setModel] = useState("design-5");
  const [effort, setEffort] = useState("medium");
  const [design, setDesign] = useState({ type: "none" });
  const [urlDraft, setUrlDraft] = useState("");
  const [menu, setMenu] = useState(null);
  const [codeView, setCodeView] = useState(false);
  const [messages, setMessages] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);
  const sessionInputRef = useRef(null);
  const chatEndRef = useRef(null);

  // AI streaming state
  const [phase, setPhase] = useState("idle");
  const [thinkingText, setThinkingText] = useState("");
  const [todos, setTodos] = useState([]);

  // AI provider state (persisted in localStorage)
  const [aiProvider, setAiProvider] = useState("ollama");
  const [aiApiKey, setAiApiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://127.0.0.1:11434");
  const [showProviderSettings, setShowProviderSettings] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState("unknown"); // unknown | checking | online | offline

  // Load saved provider settings from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sd_ai_provider") || "{}");
      if (saved.provider) setAiProvider(saved.provider);
      if (saved.apiKey) setAiApiKey(saved.apiKey);
      if (saved.ollamaUrl) setOllamaUrl(saved.ollamaUrl);
    } catch {}
  }, []);

  // Save provider settings to localStorage
  function saveProviderSettings(provider, key, urlVal = ollamaUrl) {
    setAiProvider(provider);
    setAiApiKey(key);
    setOllamaUrl(urlVal);
    try { localStorage.setItem("sd_ai_provider", JSON.stringify({ provider, apiKey: key, ollamaUrl: urlVal })); } catch {}
  }

  // Check Ollama availability
  function checkOllama(urlToCheck = ollamaUrl) {
    setOllamaStatus("checking");
    const cleanUrl = urlToCheck.replace(/\/$/, "");
    fetch(`${cleanUrl}/api/tags`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? setOllamaStatus("online") : setOllamaStatus("offline"))
      .catch(() => {
        // Fallback: if we were checking 127.0.0.1 and it failed, try localhost as backup
        if (cleanUrl.includes("127.0.0.1")) {
          fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) })
            .then(r2 => r2.ok ? setOllamaStatus("online") : setOllamaStatus("offline"))
            .catch(() => setOllamaStatus("offline"));
        } else {
          setOllamaStatus("offline");
        }
      });
  }

  const modelObj = MODELS.find((m) => m.id === model);
  const designLabel =
    design.type === "ready" ? ready.find((d) => d.slug === design.slug)?.name || design.slug
    : design.type === "url" ? design.url
    : "None";

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingText, todos, phase]);

  function pickTemplate(id) {
    setTemplate(id);
    const owner = TEMPLATES.find((t) => t.id === id).model;
    setModel(owner);
    setMenu(null);
  }
  function pickModel(id) {
    setModel(id);
    const m = MODELS.find((x) => x.id === id);
    if (!m.templates.includes(template)) setTemplate(m.templates[0]);
  }

  async function send(text, { blank = false } = {}) {
    const p = blank ? "" : (text ?? prompt).trim();
    if (sending || (!p && !blank)) return;
    setSending(true);
    setView("session");
    if (p) setMessages((ms) => [...ms, { role: "user", text: p }]);
    setPrompt("");

    // Design 5 uses the AI streaming pipeline
    if (model === "design-5") {
      // Check provider setup
      const providerInfo = AI_PROVIDERS.find(pr => pr.id === aiProvider);
      if (providerInfo?.needsKey && !aiApiKey) {
        setMessages((ms) => [...ms, { role: "assistant", text: `Please set your ${providerInfo.label} API key first. Click the ⚙ settings button.` }]);
        setSending(false);
        return;
      }

      setPhase("thinking");
      setThinkingText("");
      setTodos([]);

      try {
        if (aiProvider === "ollama") {
          // ---- OLLAMA: direct call from the browser ----
          const cleanOllamaUrl = ollamaUrl.replace(/\/$/, "");
          const res = await fetch(`${cleanOllamaUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gemma4:31b-cloud",
              stream: true,
              messages: [
                { role: "system", content: OLLAMA_SYSTEM_PROMPT },
                { role: "user", content: p },
              ],
            }),
          });
          if (!res.ok) {
            throw new Error(res.status === 0 ? "Cannot connect to Ollama. Make sure it's running with CORS enabled." : `Ollama error (${res.status})`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let fullText = "";
          let buffer = "";
          let lastPhase = "thinking";
          let todosEmitted = false;
          let doneTodos = new Set();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const json = JSON.parse(line);
                const content = json.message?.content || "";
                fullText += content;

                // Parse phases from accumulated text
                const parsed = parseOllamaChunks(fullText);

                // Thinking phase
                if (parsed.thinking && lastPhase === "thinking") {
                  setThinkingText(parsed.thinking);
                  if (fullText.includes("[/THINKING]")) lastPhase = "plan";
                }

                // Plan phase
                if (parsed.plan && !todosEmitted) {
                  setPhase("planning");
                  setTodos(parsed.plan.map(t => ({ text: t, done: false })));
                  todosEmitted = true;
                  lastPhase = "code";
                }

                // Code phase — track progress via todo checkmarks
                if (lastPhase === "code" && fullText.includes("[CODE]")) {
                  setPhase("building");
                  const codeText = fullText.slice(fullText.indexOf("[CODE]") + 6);
                  const progress = estimateProgress(codeText);
                  if (todosEmitted) {
                    for (let i = 0; i < progress; i++) {
                      if (!doneTodos.has(i)) {
                        doneTodos.add(i);
                        setTodos(prev => prev.map((t, idx) => idx === i ? { ...t, done: true } : t));
                      }
                    }
                  }
                }

                // Code complete
                if (parsed.codeHtml) {
                  setPhase("done");
                  setTodos(prev => prev.map(t => ({ ...t, done: true })));
                  setArtifacts(a => {
                    setActive(a.length);
                    return [...a, { name: `v${a.length + 1}.html`, html: guardHtmlClient(parsed.codeHtml), systemName: "Design 5" }];
                  });
                  setMessages(ms => [...ms, {
                    role: "assistant",
                    text: "Built your design. The artifact is rendered on the right.",
                    meta: `Design 5 · Ollama · gemma4:31b-cloud`,
                  }]);
                }
              } catch {}
            }
          }

          // Fallback if code tags weren't properly closed
          if (phase !== "done" && fullText.includes("[CODE]")) {
            const html = fullText.slice(fullText.indexOf("[CODE]") + 6).replace("[/CODE]", "").trim();
            if (html.includes("<html") || html.includes("<!doctype") || html.includes("<!DOCTYPE")) {
              setPhase("done");
              setTodos(prev => prev.map(t => ({ ...t, done: true })));
              setArtifacts(a => {
                setActive(a.length);
                return [...a, { name: `v${a.length + 1}.html`, html: guardHtmlClient(html), systemName: "Design 5" }];
              });
              setMessages(ms => [...ms, { role: "assistant", text: "Built your design.", meta: "Design 5 · Ollama" }]);
            }
          }

        } else {
          // ---- CLOUD PROVIDERS: route through server API ----
          const res = await fetch("/api/studio/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ prompt: p, design, provider: aiProvider, apiKey: aiApiKey }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Generation failed.");
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            buffer = parseNDJSON(buffer, (event) => {
              switch (event.type) {
                case "thinking":
                  setPhase("thinking");
                  setThinkingText(prev => prev + event.text);
                  break;
                case "plan":
                  setPhase("planning");
                  setTodos(event.todos);
                  break;
                case "todo_done":
                  setPhase("building");
                  setTodos(prev => prev.map((t, i) => i === event.index ? { ...t, done: true } : t));
                  break;
                case "code":
                  setPhase("done");
                  setArtifacts(a => {
                    setActive(a.length);
                    return [...a, { name: `v${a.length + 1}.html`, html: event.html, systemName: "Design 5" }];
                  });
                  setMessages(ms => [...ms, {
                    role: "assistant",
                    text: "Built your design. The artifact is rendered on the right.",
                    meta: `Design 5 · ${providerInfo.label}`,
                  }]);
                  setTodos(prev => prev.map(t => ({ ...t, done: true })));
                  break;
                case "error":
                  throw new Error(event.message);
              }
            });
          }
        }
      } catch (e) {
        setMessages(ms => [...ms, { role: "assistant", text: `Couldn't build that: ${e.message}` }]);
        setPhase("idle");
      } finally {
        setSending(false);
        setPhase(prev => prev === "done" ? "done" : "idle");
      }
      return;
    }

    // Other models: use the existing template engine
    try {
      const res = await fetch("/api/studio", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: p, template, effort, design, version: artifacts.length + 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build failed.");
      setArtifacts((a) => {
        setActive(a.length);
        return [...a, { name: data.fileName, html: data.html, systemName: data.systemName }];
      });
      setMessages((ms) => [...ms, { role: "assistant", text: data.reply, meta: `${data.systemName} · ${template} · ${data.fileName}` }]);
    } catch (e) {
      setMessages((ms) => [...ms, { role: "assistant", text: `Couldn't build that: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  }

  function share() {
    const art = artifacts[active];
    if (!art) return;
    const blob = new Blob([art.html], { type: "text/html;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = art.name;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const designMenu = (
    <Menu open={menu === "design"} onClose={() => setMenu(null)}>
      <button onClick={() => { setDesign({ type: "none" }); setMenu(null); }} className="w-full text-left px-4 py-2 text-xs text-snow hover:bg-void">None <span className="text-fog">— Source Design defaults</span></button>
      <button onClick={() => setMenu("url")} className="w-full text-left px-4 py-2 text-xs text-cyan hover:bg-void">From URL…</button>
      <div className="my-1 border-t border-line" />
      {ready.map((d) => (
        <button key={d.slug} onClick={() => { setDesign({ type: "ready", slug: d.slug }); setMenu(null); }} className="w-full text-left px-4 py-2 text-xs text-snow hover:bg-void flex items-center gap-2">
          <span className="flex">{d.chips.slice(0, 3).map((h, i) => <span key={i} className="w-3 h-3 border border-line -ml-px first:ml-0" style={{ backgroundColor: h }} />)}</span>
          {d.name}
        </button>
      ))}
    </Menu>
  );

  const urlMenu = (
    <Menu open={menu === "url"} onClose={() => setMenu(null)} width="w-72">
      <form
        className="p-3"
        onSubmit={(e) => { e.preventDefault(); if (urlDraft.trim()) { setDesign({ type: "url", url: urlDraft.trim() }); setMenu(null); } }}
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-fog">Extract tokens from your site</p>
        <input
          autoFocus
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          placeholder="yoursite.com"
          className="mt-2 w-full h-9 px-3 bg-void border border-line text-snow font-mono text-xs outline-none focus:border-cyan"
        />
        <button type="submit" className="press mt-2 w-full h-8 rounded-[75px] bg-cyan text-void text-xs font-medium">Use this site</button>
      </form>
    </Menu>
  );

  const templateMenu = (
    <Menu open={menu === "template"} onClose={() => setMenu(null)} width="w-48">
      {TEMPLATES.map((t) => (
        <button key={t.id} onClick={() => pickTemplate(t.id)} className={`w-full text-left px-4 py-2 text-xs hover:bg-void ${template === t.id ? "text-cyan" : "text-snow"}`}>{t.label}</button>
      ))}
    </Menu>
  );

  const modelMenu = (
    <Menu open={menu === "model"} onClose={() => setMenu(null)} align="right" width="w-72">
      {MODELS.map((m) => (
        <button key={m.id} onClick={() => { pickModel(m.id); }} className="w-full text-left px-4 py-2.5 hover:bg-void flex items-start gap-3">
          <span className="flex-1">
            <span className={`block text-xs font-medium ${model === m.id ? "text-cyan" : "text-snow"}`}>{m.label}</span>
            <span className="block text-[11px] text-fog mt-0.5">{m.tag}</span>
          </span>
          {model === m.id && <span className="text-cyan text-xs mt-0.5">✓</span>}
        </button>
      ))}
      <div className="my-1 border-t border-line" />
      <div className="px-4 py-2.5 flex items-center justify-between">
        <span className="text-xs text-snow font-medium">Effort</span>
        <span className="flex items-center gap-1 border border-line rounded-[75px] p-0.5">
          {EFFORTS.map((e) => (
            <button key={e} onClick={() => setEffort(e)} className={`press px-2.5 h-6 rounded-[75px] text-[10px] capitalize ${effort === e ? "bg-cyan text-void font-medium" : "text-fog hover:text-snow"}`}>{e}</button>
          ))}
        </span>
      </div>
    </Menu>
  );

  function ProviderSettingsModal() {
    if (!showProviderSettings) return null;
    const providerInfo = AI_PROVIDERS.find(p => p.id === aiProvider);

    return (
      <div className="fixed inset-0 bg-void/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md border border-line bg-surface p-6 rounded-lg relative shadow-2xl">
          <button
            onClick={() => setShowProviderSettings(false)}
            className="absolute top-4 right-4 text-fog hover:text-snow text-lg"
          >
            ✕
          </button>
          
          <h2 className="text-lg font-medium text-snow flex items-center gap-2">
            <svg viewBox="0 0 16 16" className="w-4 h-4 text-cyan" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1v3M8 12v3M1 8h3M12 8h3M4.5 4.5l2 2M9.5 9.5l2 2M4.5 11.5l2-2M9.5 4.5l2 2" />
              <circle cx="8" cy="8" r="2" />
            </svg>
            AI Design Engine settings
          </h2>
          <p className="text-xs text-fog mt-1">Configure your AI provider for Design 5. Settings are saved locally in your browser.</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-fog mb-2">Provider</label>
              <div className="grid grid-cols-2 gap-2">
                {AI_PROVIDERS.map((pr) => (
                  <button
                    key={pr.id}
                    onClick={() => {
                      saveProviderSettings(pr.id, pr.id === aiProvider ? aiApiKey : "");
                      if (pr.id === "ollama") checkOllama();
                    }}
                    className={`press p-3 border text-left rounded-md transition-all ${
                      aiProvider === pr.id ? "border-cyan bg-cyan/5" : "border-line hover:border-fog/50"
                    }`}
                  >
                    <span className={`block text-xs font-semibold ${aiProvider === pr.id ? "text-cyan" : "text-snow"}`}>{pr.label}</span>
                    <span className="block text-[9px] text-fog mt-0.5">{pr.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {aiProvider === "ollama" ? (
              <div className="border border-line bg-void/50 p-4 rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-snow">Local Ollama Status</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      ollamaStatus === "online" ? "bg-green-400" : ollamaStatus === "offline" ? "bg-red-400" : "bg-yellow-400"
                    }`} />
                    <span className="text-[10px] font-mono uppercase text-fog">
                      {ollamaStatus === "online" ? "Online" : ollamaStatus === "offline" ? "Offline" : "Checking…"}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-fog">Ollama Endpoint URL</label>
                  <input
                    type="text"
                    value={ollamaUrl}
                    onChange={(e) => saveProviderSettings(aiProvider, aiApiKey, e.target.value)}
                    placeholder="http://127.0.0.1:11434"
                    className="w-full h-8 px-2 bg-void border border-line text-snow font-mono text-xs outline-none focus:border-cyan"
                  />
                </div>

                {ollamaStatus === "offline" && (
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded text-[11px] text-snow/90 space-y-2">
                    <p className="font-semibold text-red-400">⚠️ CORS Connection Blocked</p>
                    <p className="leading-relaxed">
                      If Ollama is running but shows Offline, the browser is blocking connection requests. To allow connections:
                    </p>
                    <div className="space-y-1">
                      <span className="block text-[9px] uppercase tracking-wider text-fog font-mono">1. Exit Ollama from System Tray (Taskbar)</span>
                      <span className="block text-[9px] uppercase tracking-wider text-fog font-mono">2. Start it with CORS from PowerShell:</span>
                      <pre className="bg-void p-1.5 font-mono text-[10px] rounded select-all overflow-x-auto text-cyan">
                        $env:OLLAMA_ORIGINS="*" ; ollama serve
                      </pre>
                    </div>
                    <p className="text-[10px] text-fog">
                      Keep the PowerShell window open and click Refresh status.
                    </p>
                  </div>
                )}

                <p className="text-xs text-fog leading-relaxed">
                  To use this feature for <strong>absolutely free</strong> without any API keys or limits, run Ollama locally on your computer with this model:
                </p>
                <div className="bg-void p-2 font-mono text-[11px] text-snow border border-line rounded flex items-center justify-between">
                  <span>ollama run gemma4:31b-cloud</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("ollama run gemma4:31b-cloud");
                    }}
                    className="text-[10px] text-cyan hover:underline"
                  >
                    Copy
                  </button>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => checkOllama()}
                    className="press flex-1 h-8 rounded border border-line text-xs text-snow hover:border-fog"
                  >
                    Refresh status
                  </button>
                  <a
                    href="https://ollama.com"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--color-void)" }}
                    className="press flex-1 h-8 rounded bg-cyan text-xs font-semibold flex items-center justify-center gap-1 hover:no-underline"
                  >
                    Download Ollama
                    <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 3l5 5-5 5" />
                    </svg>
                  </a>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-[10px] font-mono uppercase tracking-[0.1em] text-fog">
                  {providerInfo?.label} API Key
                </label>
                <input
                  type="password"
                  value={aiApiKey}
                  onChange={(e) => saveProviderSettings(aiProvider, e.target.value)}
                  placeholder={`Enter your ${providerInfo?.label} key (${providerInfo?.placeholder})`}
                  className="w-full h-9 px-3 bg-void border border-line text-snow font-mono text-xs outline-none focus:border-cyan"
                />
                <p className="text-[10px] text-fog">
                  Your key is sent directly to the model provider from your browser/server. It is never stored.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowProviderSettings(false)}
              className="press w-full h-9 rounded bg-snow text-void text-xs font-semibold mt-2"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  function ComposerControls({ compact = false }) {
    const providerInfo = AI_PROVIDERS.find(p => p.id === aiProvider);

    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative">
          <button
            type="button"
            aria-label="Use your site's design"
            onClick={() => setMenu(menu === "url" ? null : "url")}
            className="press w-9 h-9 border border-line rounded-md text-fog hover:text-snow hover:border-fog text-lg leading-none"
          >
            +
          </button>
          {urlMenu}
        </div>
        <div className="relative">
          <Chip label="Design system" value={designLabel} active={design.type !== "none"} onClick={() => setMenu(menu === "design" ? null : "design")} />
          {designMenu}
        </div>
        {!compact && (
          <div className="relative">
            <Chip label="Template" value={TEMPLATES.find((t) => t.id === template).label} onClick={() => setMenu(menu === "template" ? null : "template")} />
            {templateMenu}
          </div>
        )}
        {!compact && (
          <button
            type="button"
            aria-pressed={codeView}
            onClick={() => setCodeView((v) => !v)}
            title="Open results in code view"
            className={`press w-9 h-9 border rounded-md font-mono text-xs ${codeView ? "border-cyan text-cyan" : "border-line text-fog hover:text-snow"}`}
          >
            {"</>"}
          </button>
        )}
        <div className="relative ml-auto">
          <Chip label="Model" value={`${modelObj.label} · ${effort}`} onClick={() => setMenu(menu === "model" ? null : "model")} />
          {modelMenu}
        </div>
        
        {/* Settings Button */}
        {model === "design-5" && (
          <button
            type="button"
            onClick={() => {
              setShowProviderSettings(true);
              if (aiProvider === "ollama") checkOllama();
            }}
            title="AI Engine Settings"
            className="press w-9 h-9 border border-line rounded-md text-fog hover:text-snow hover:border-fog flex items-center justify-center"
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2" />
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5l1.5-1.5M11 5l1.5-1.5" />
            </svg>
          </button>
        )}

        <button
          type="button"
          onClick={() => send()}
          disabled={sending || !prompt.trim()}
          aria-label="Send"
          className="press w-9 h-9 rounded-md bg-cyan text-void font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ↑
        </button>
      </div>
    );
  }

  // ---------- landing ----------
  if (view === "landing") {
    return (
      <div className="min-h-[100dvh] flex flex-col overflow-x-clip">
        <SiteHeader current="your-design" />
        <main className="flex-1 relative flex flex-col items-center justify-center px-5 py-16">
          {/* Lovable-composition glow, Mercury Flow hues: dark top, field saturating
              through the lower half, bright horizontal bloom behind the composer,
              color held to the bottom edge */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            {/* main field: fills the lower two-thirds, fades in from the top */}
            <div
              className="absolute left-[-20%] right-[-20%] top-[28%] bottom-[-12%] blur-[90px]"
              style={{
                background: "linear-gradient(90deg, rgb(160, 224, 171), rgb(255, 172, 46) 50%, rgb(165, 45, 37))",
                opacity: 0.55,
                maskImage: "linear-gradient(180deg, transparent 0%, black 42%, black 100%)",
                WebkitMaskImage: "linear-gradient(180deg, transparent 0%, black 42%, black 100%)",
              }}
            />
            {/* bright bloom band at composer height */}
            <div
              className="absolute inset-0 blur-[50px]"
              style={{
                background: "radial-gradient(58% 34% at 50% 58%, rgba(255, 196, 110, 0.45), transparent 72%)",
              }}
            />
            {/* secondary hue lobes, like the pic's blue/pink split: green left, red right */}
            <div
              className="absolute inset-0 blur-[80px]"
              style={{
                background:
                  "radial-gradient(40% 45% at 12% 78%, rgba(160, 224, 171, 0.35), transparent 70%), radial-gradient(40% 45% at 88% 78%, rgba(165, 45, 37, 0.45), transparent 70%)",
              }}
            />
            {/* dark top: void holds the upper third */}
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, var(--color-void) 8%, transparent 52%)" }}
            />
          </div>

          <h1 className="relative font-light tracking-tight text-snow text-center text-[clamp(2rem,5vw,3.6rem)]">
            What will you design today?
          </h1>

          <div className="relative mt-10 w-full max-w-[880px] border border-line bg-surface/90 p-5">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Design a pricing page for a coffee subscription…"
              rows={3}
              className="w-full bg-transparent text-snow text-sm leading-relaxed placeholder:text-fog/60 outline-none resize-none"
            />
            <ComposerControls />
          </div>

          <p className="relative mt-12 text-[11px] font-mono uppercase tracking-[0.14em] text-fog">
            Start with a template…
          </p>
          <div className="relative mt-6 flex justify-center items-center h-[180px] w-full max-w-[500px] z-10" aria-hidden="true">
            <BounceCards
              images={TEMPLATES.map((t) => ({
                width: "115px",
                height: "130px",
                bg: "var(--color-surface)",
                onClick: () => { pickTemplate(t.id); inputRef.current?.focus(); },
                render: () => (
                  <div className="flex flex-col items-center justify-center gap-3 w-full h-full p-2 text-center select-none">
                    <TemplateGlyph id={t.id} />
                    <span className="text-xs text-snow font-medium">{t.label}</span>
                  </div>
                )
              }))}
              containerWidth={500}
              containerHeight={180}
              animationDelay={0.3}
              animationStagger={0.06}
              easeType="elastic.out(1, 0.8)"
              transformStyles={[
                "rotate(-12deg) translate(-170px, 16px)",
                "rotate(-7deg) translate(-102px, 7px)",
                "rotate(-2deg) translate(-34px, 1px)",
                "rotate(2deg) translate(34px, 1px)",
                "rotate(7deg) translate(102px, 7px)",
                "rotate(12deg) translate(170px, 16px)"
              ]}
              enableHover={true}
            />
          </div>

          <button
            type="button"
            onClick={() => send("", { blank: true })}
            className="relative mt-12 text-sm text-fog hover:text-cyan transition-colors"
          >
            …or start a blank project →
          </button>
        </main>
        <ProviderSettingsModal />
      </div>
    );
  }

  // ---------- session ----------
  const art = artifacts[active];
  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden">
      <SiteHeader current="your-design" />
      <div className="flex-1 flex min-h-0">
        {/* left: chat */}
        <aside className="w-full max-w-[340px] border-r border-line flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <p className="text-xl font-light text-snow">Start with context</p>
                <p className="mt-2 text-xs text-fog max-w-[26ch]">Designs grounded in a real token system turn out better.</p>
                <div className="mt-5 flex flex-col gap-2 w-full max-w-[200px]">
                  <button onClick={() => setMenu("design")} className="press h-9 border border-line rounded-[75px] text-xs text-snow hover:border-cyan">Design system</button>
                  <button onClick={() => setMenu("url")} className="press h-9 border border-line rounded-[75px] text-xs text-snow hover:border-cyan">Your URL</button>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-6" : "mr-2"}>
                <div className={`text-sm leading-relaxed p-3 border ${m.role === "user" ? "bg-surface border-line text-snow" : "border-transparent text-fog"}`}>
                  {m.text}
                </div>
                {m.meta && <p className="mt-1 px-3 font-mono text-[10px] text-fog">{m.meta}</p>}
              </div>
            ))}

            {/* AI Thinking Phase */}
            {sending && phase === "thinking" && (
              <div className="mr-2 space-y-2">
                <div className="flex items-center gap-2 text-xs text-cyan">
                  <span className="inline-block w-2 h-2 rounded-full bg-cyan animate-pulse" />
                  Design 5 is thinking…
                </div>
                {thinkingText && (
                  <div className="text-xs text-fog/80 italic leading-relaxed p-3 border border-line/50 bg-surface/50 rounded-md">
                    {thinkingText}
                  </div>
                )}
              </div>
            )}

            {/* AI Plan Phase — Claude-style todo card */}
            {todos.length > 0 && (
              <div className="mr-2">
                <div className="border border-line bg-surface rounded-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-line flex items-center gap-2">
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-cyan" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="2" width="12" height="12" rx="2" />
                      <path d="M5 8l2 2 4-4" />
                    </svg>
                    <span className="text-xs font-medium text-snow">Updated todos</span>
                    <span className="ml-auto text-[10px] text-fog font-mono">
                      {todos.filter(t => t.done).length}/{todos.length}
                    </span>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {todos.map((todo, i) => (
                      <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded text-xs">
                        <span className={`mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center transition-all duration-300 ${
                          todo.done
                            ? "bg-cyan border-cyan text-void"
                            : "border-fog/40"
                        }`}>
                          {todo.done && (
                            <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </span>
                        <span className={`leading-relaxed transition-colors duration-300 ${
                          todo.done ? "text-fog line-through" : "text-snow"
                        }`}>
                          {todo.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                {sending && phase === "building" && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-cyan">
                    <span className="inline-block w-2 h-2 rounded-full bg-cyan animate-pulse" />
                    Building artifact…
                  </div>
                )}
              </div>
            )}

            {/* Simple skeleton for non-AI models */}
            {sending && model !== "design-5" && <div className="skeleton h-16 mr-2" />}

            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-line p-3">
            <textarea
              ref={sessionInputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Describe what you want to create…"
              rows={2}
              className="w-full bg-transparent text-snow text-sm placeholder:text-fog/60 outline-none resize-none"
            />
            <ComposerControls compact />
          </div>
        </aside>

        {/* right: canvas */}
        <section className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="h-12 shrink-0 border-b border-line flex items-center gap-3 px-4">
            <div className="relative">
              <button
                onClick={() => setMenu(menu === "file" ? null : "file")}
                className="text-xs font-mono text-snow hover:text-cyan transition-colors"
              >
                {art ? art.name : "No file open"} ⌄
              </button>
              {menu === "file" && artifacts.length > 0 && (
                <div className="absolute top-full mt-2 left-0 w-48 border border-line bg-surface z-30 py-1">
                  {artifacts.map((a, i) => (
                    <button key={i} onClick={() => { setActive(i); setMenu(null); }} className={`w-full text-left px-4 py-2 font-mono text-xs hover:bg-void ${i === active ? "text-cyan" : "text-snow"}`}>
                      {a.name} <span className="text-fog">· {a.systemName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setCodeView((v) => !v)}
                aria-pressed={codeView}
                className={`press px-3 h-8 border rounded-[75px] font-mono text-[11px] ${codeView ? "border-cyan text-cyan" : "border-line text-fog hover:text-snow"}`}
              >
                {"</>"}
              </button>
              <button
                onClick={share}
                disabled={!art}
                className="press px-4 h-8 rounded-[75px] bg-cyan text-void text-xs font-medium disabled:opacity-40"
              >
                Share
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-void">
            {!art && (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-fog">Send a brief — the artifact renders here.</p>
              </div>
            )}
            {art && !codeView && (
              <iframe
                title={art.name}
                srcDoc={art.html}
                sandbox="allow-scripts allow-forms"
                className="w-full h-full bg-white"
              />
            )}
            {art && codeView && (
              <pre className="h-full overflow-auto p-5 font-mono text-xs leading-relaxed text-snow/80">
                <code>{art.html}</code>
              </pre>
            )}
          </div>
        </section>
      </div>
      <ProviderSettingsModal />
    </div>
  );
}
