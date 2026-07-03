import { SB_URL, SB_KEY } from "../../../lib/counts";
import index from "../../../lib/ready/index.json";

const SLUGS = new Set(index.map((d) => d.slug));
const HEADERS = { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}` };

export async function GET() {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/sd_ready_counts?select=slug,installs,bookmarks`,
      { headers: HEADERS, cache: "no-store" }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Response.json(await res.json());
  } catch {
    return Response.json([], { status: 200 }); // counters degrade, page still works
  }
}

export async function POST(req) {
  let slug, kind;
  try {
    ({ slug, kind } = await req.json());
  } catch {
    return Response.json({ error: "bad body" }, { status: 400 });
  }
  if (!SLUGS.has(slug) || !["install", "bookmark"].includes(kind)) {
    return Response.json({ error: "unknown slug or kind" }, { status: 400 });
  }
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/sd_bump`, {
      method: "POST",
      headers: { ...HEADERS, "content-type": "application/json" },
      body: JSON.stringify({ p_slug: slug, p_kind: kind }),
    });
    return Response.json({ ok: res.ok });
  } catch {
    return Response.json({ ok: false });
  }
}
