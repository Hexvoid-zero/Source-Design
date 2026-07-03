"use client";

import { useEffect, useState } from "react";

export default function BookmarkButton({ slug }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      setSaved(localStorage.getItem(`sd-bookmark-${slug}`) === "1");
    } catch {}
  }, [slug]);

  function toggle() {
    if (saved) {
      // local un-save only; the global counter records that it was ever saved
      try { localStorage.removeItem(`sd-bookmark-${slug}`); } catch {}
      setSaved(false);
      return;
    }
    try { localStorage.setItem(`sd-bookmark-${slug}`, "1"); } catch {}
    setSaved(true);
    fetch("/api/count", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, kind: "bookmark" }),
    }).catch(() => {});
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={saved}
      className={`press px-5 h-9 rounded-[75px] text-xs transition-colors ${
        saved
          ? "bg-cyan text-void font-medium"
          : "border border-line text-snow hover:border-fog"
      }`}
    >
      {saved ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
