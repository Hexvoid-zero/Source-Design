// Multi-provider AI streaming for Design 5
// Supports: Google Gemini, OpenAI, Anthropic (server-side via API route)
// Ollama is called directly from the browser (client-side)

import { buildSystemPrompt } from "./gemini.js"; // reuse the system prompt builder

/**
 * Stream from Google Gemini API using raw fetch (no SDK needed on server).
 */
export async function* streamGemini(apiKey, systemPrompt, userPrompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) throw new Error("Invalid Google API key.");
    if (res.status === 429) throw new Error("Google API rate limit exceeded. Wait a moment and try again.");
    throw new Error(`Google API error (${res.status}): ${err.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {}
    }
  }
}

/**
 * Stream from OpenAI API.
 */
export async function* streamOpenAI(apiKey, systemPrompt, userPrompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 16000,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Invalid OpenAI API key.");
    if (res.status === 429) throw new Error("OpenAI rate limit exceeded. Wait a moment and try again.");
    throw new Error(`OpenAI API error (${res.status}): ${err.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const json = JSON.parse(data);
        const text = json.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {}
    }
  }
}

/**
 * Stream from Anthropic API.
 */
export async function* streamAnthropic(apiKey, systemPrompt, userPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    if (res.status === 401) throw new Error("Invalid Anthropic API key.");
    if (res.status === 429) throw new Error("Anthropic rate limit exceeded. Wait a moment and try again.");
    throw new Error(`Anthropic API error (${res.status}): ${err.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        if (json.type === "content_block_delta" && json.delta?.text) {
          yield json.delta.text;
        }
      } catch {}
    }
  }
}

/**
 * Route to the correct provider stream.
 */
export function getProviderStream(provider, apiKey, systemPrompt, userPrompt) {
  switch (provider) {
    case "google": return streamGemini(apiKey, systemPrompt, userPrompt);
    case "openai": return streamOpenAI(apiKey, systemPrompt, userPrompt);
    case "anthropic": return streamAnthropic(apiKey, systemPrompt, userPrompt);
    default: throw new Error(`Unknown provider: ${provider}`);
  }
}

export { buildSystemPrompt };
