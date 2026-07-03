import { extractDesign } from "../../../lib/extract";
import { proposeSystem } from "../../../lib/propose";

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
    const extraction = await extractDesign(url.trim());
    const proposal = proposeSystem(extraction);
    return Response.json(proposal);
  } catch (e) {
    const msg = e?.name === "AbortError" ? "The site took too long to respond." : e?.message || "Proposal failed.";
    return Response.json({ error: msg }, { status: 422 });
  }
}
