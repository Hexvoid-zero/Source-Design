import { extractDesign } from "../../../lib/extract";

export const maxDuration = 30;

export async function POST(req) {
  let url;
  try {
    ({ url } = await req.json());
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!url || typeof url !== "string" || url.length > 2048) {
    return Response.json({ error: "Provide a URL." }, { status: 400 });
  }
  try {
    const result = await extractDesign(url.trim());
    delete result.raw; // internal mining data, not part of the API payload
    return Response.json(result);
  } catch (e) {
    const msg = e?.name === "AbortError" ? "The site took too long to respond." : e?.message || "Extraction failed.";
    return Response.json({ error: msg }, { status: 422 });
  }
}
