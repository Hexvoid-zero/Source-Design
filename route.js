// Streaming AI design generation endpoint
// Accepts provider + apiKey from the client, routes to the correct AI service
// Streams NDJSON events: thinking → plan → todo_done → code

import { resolveTheme } from "../../../../lib/studio.js";
import { buildSystemPrompt } from "../../../../lib/gemini.js";
import { getProviderStream } from "../../../../lib/providers.js";

export const maxDuration = 60;

// Simple in-memory rate limiter (resets on cold start)
const rateMap = new Map();
const RATE_LIMIT = 10; // max requests per minute per IP
const RATE_WINDOW = 60_000;

function checkRate(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.start > RATE_WINDOW) {
    rateMap.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const VALID_PROVIDERS = new Set(["google", "openai", "anthropic"]);

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

function guardHtml(html) {
  const code = html.trim();
  if (code.includes("</body>")) {
    return code.replace("</body>", `${LINK_GUARD}</body>`);
  }
  return `${code}${LINK_GUARD}`;
}

export async function POST(req) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  if (!checkRate(ip)) {
    return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { prompt, design, provider, apiKey } = body;

  if (!prompt || typeof prompt !== "string" || prompt.length > 2000) {
    return Response.json({ error: "Provide a prompt (max 2000 chars)." }, { status: 400 });
  }
  if (!VALID_PROVIDERS.has(provider)) {
    return Response.json({ error: "Unknown provider. Use google, openai, or anthropic." }, { status: 400 });
  }
  if (!apiKey || typeof apiKey !== "string" || apiKey.length < 10) {
    return Response.json({ error: "A valid API key is required." }, { status: 400 });
  }

  // Resolve theme tokens
  let theme;
  try {
    theme = await resolveTheme(design);
  } catch (e) {
    return Response.json({ error: `Theme error: ${e.message}` }, { status: 422 });
  }

  const systemPrompt = buildSystemPrompt(theme);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        let fullText = "";
        let phase = "thinking";
        let thinkingBuffer = "";
        let planEmitted = false;
        let codeBuffer = "";
        let codeStarted = false;

        const providerStream = getProviderStream(provider, apiKey, systemPrompt, prompt);

        for await (const chunk of providerStream) {
          fullText += chunk;

          // Parse phases from the accumulated text
          if (phase === "thinking") {
            const thinkStart = fullText.indexOf("[THINKING]");
            const thinkEnd = fullText.indexOf("[/THINKING]");

            if (thinkStart !== -1 && thinkEnd === -1) {
              const newThinking = fullText.slice(thinkStart + "[THINKING]".length).trim();
              if (newThinking.length > thinkingBuffer.length) {
                const delta = newThinking.slice(thinkingBuffer.length);
                thinkingBuffer = newThinking;
                send({ type: "thinking", text: delta });
              }
            } else if (thinkEnd !== -1) {
              const finalThinking = fullText.slice(thinkStart + "[THINKING]".length, thinkEnd).trim();
              if (finalThinking.length > thinkingBuffer.length) {
                const delta = finalThinking.slice(thinkingBuffer.length);
                send({ type: "thinking", text: delta });
              }
              phase = "plan";
            } else if (thinkStart === -1 && fullText.length > 50) {
              if (fullText.includes("[PLAN]")) {
                phase = "plan";
              }
            }
          }

          if (phase === "plan" && !planEmitted) {
            const planStart = fullText.indexOf("[PLAN]");
            const planEnd = fullText.indexOf("[/PLAN]");

            if (planStart !== -1 && planEnd !== -1) {
              const planText = fullText.slice(planStart + "[PLAN]".length, planEnd).trim();
              const todos = planText
                .split("\n")
                .map((line) => line.replace(/^\d+\.\s*/, "").trim())
                .filter((line) => line.length > 0)
                .map((text) => ({ text, done: false }));
              send({ type: "plan", todos });
              planEmitted = true;
              phase = "code";
            }
          }

          if (phase === "code") {
            const codeStart = fullText.indexOf("[CODE]");
            const codeEnd = fullText.indexOf("[/CODE]");

            if (codeStart !== -1 && !codeStarted) {
              codeStarted = true;
            }

            if (codeStarted && codeEnd === -1) {
              const currentCode = fullText.slice(codeStart + "[CODE]".length);
              const progress = estimateProgress(currentCode);
              if (planEmitted) {
                for (let i = 0; i < progress; i++) {
                  if (!codeBuffer.includes(`todo_${i}`)) {
                    codeBuffer += `todo_${i}`;
                    send({ type: "todo_done", index: i });
                  }
                }
              }
            }

            if (codeStarted && codeEnd !== -1) {
              const html = fullText.slice(codeStart + "[CODE]".length, codeEnd).trim();

              if (planEmitted) {
                const planText = fullText.slice(fullText.indexOf("[PLAN]") + "[PLAN]".length, fullText.indexOf("[/PLAN]")).trim();
                const todoCount = planText.split("\n").filter(l => l.trim()).length;
                for (let i = 0; i < todoCount; i++) {
                  if (!codeBuffer.includes(`todo_${i}`)) {
                    codeBuffer += `todo_${i}`;
                    send({ type: "todo_done", index: i });
                  }
                }
              }

              send({ type: "code", html: guardHtml(html) });
              send({ type: "done" });
              controller.close();
              return;
            }
          }
        }

        // Fallback: try to extract HTML if stream ended without proper tags
        const fallbackCode = fullText.indexOf("[CODE]");
        if (fallbackCode !== -1) {
          const html = fullText.slice(fallbackCode + "[CODE]".length).replace("[/CODE]", "").trim();
          if (html.includes("<html") || html.includes("<!doctype") || html.includes("<!DOCTYPE")) {
            send({ type: "code", html: guardHtml(html) });
            send({ type: "done" });
          } else {
            send({ type: "error", message: "The AI generated an incomplete response. Please try again." });
          }
        } else if (fullText.includes("<!doctype") || fullText.includes("<!DOCTYPE") || fullText.includes("<html")) {
          const htmlMatch = fullText.match(/(<!doctype[^]*<\/html>)/i) || fullText.match(/(<html[^]*<\/html>)/i);
          if (htmlMatch) {
            send({ type: "code", html: guardHtml(htmlMatch[1]) });
            send({ type: "done" });
          } else {
            send({ type: "error", message: "Could not parse the AI's output. Please try again." });
          }
        } else {
          send({ type: "error", message: "The AI did not generate any code. Please try again with a different prompt." });
        }

        controller.close();
      } catch (e) {
        send({ type: "error", message: e?.message || "Generation failed." });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Transfer-Encoding": "chunked",
    },
  });
}

function estimateProgress(code) {
  let progress = 0;
  if (code.includes(":root") || code.includes("--")) progress = 1;
  if (code.includes("<style") || code.includes("font-family")) progress = 2;
  if (code.includes("<nav") || code.includes("<header")) progress = 3;
  if (code.includes("<h1") || code.includes("hero")) progress = 4;
  if (code.includes("grid") || code.includes("card")) progress = 5;
  if (code.includes("pricing") || code.includes("section")) progress = 6;
  if (code.includes("<footer")) progress = 7;
  if (code.includes("hover") || code.includes("transition")) progress = 8;
  if (code.includes("@media") || code.includes("responsive")) progress = 9;
  return progress;
}
