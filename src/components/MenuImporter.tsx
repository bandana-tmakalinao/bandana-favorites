"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Cat {
  slug: string;
  name: string;
  emoji: string;
}

/**
 * Moderator menu importer. Paste a restaurant + a simple "subSlug | dish | optional description"
 * block (one item per line) and import them all as UNRANKED dishes. A preview parses the block
 * before sending. Designed for a human-in-the-loop bulk add — the dishes earn rank via duels.
 */
export default function MenuImporter({ cats }: { cats: Cat[] }) {
  const router = useRouter();
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState("");
  const [block, setBlock] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number; skips: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validSlugs = new Set(cats.map((c) => c.slug));
  const parsed = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [subSlug = "", dish = "", description = ""] = line.split("|").map((s) => s.trim());
      return { subSlug, dish, description, valid: validSlugs.has(subSlug) && !!dish };
    });
  const validCount = parsed.filter((p) => p.valid).length;

  async function submit() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/import-menu", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          placeName,
          address: address || undefined,
          source: source || undefined,
          items: parsed.filter((p) => p.valid).map(({ subSlug, dish, description }) => ({ subSlug, dish, description })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Import failed.");
      } else {
        setResult({
          added: data.added.length,
          skipped: data.skipped.length,
          skips: data.skipped.map((s: { dish: string; reason: string }) => `${s.dish} — ${s.reason}`),
        });
        setBlock("");
        router.refresh();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]";

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Restaurant name</label>
          <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} className={input} placeholder="Joe's Pizza" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Address (optional)</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={input} placeholder="7 Carmine St" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Source URL (private note, optional)</label>
        <input value={source} onChange={(e) => setSource(e.target.value)} className={input} placeholder="https://…/menu" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Menu items <span className="font-normal text-[var(--color-ink-dim)]">— one per line: <code>food-slug | Dish name | optional description</code></span>
        </label>
        <textarea
          value={block}
          onChange={(e) => setBlock(e.target.value)}
          rows={8}
          className={`${input} font-mono text-xs`}
          placeholder={"pizza | Plain Cheese Slice\npizza | Sicilian Square | thick, crispy bottom"}
        />
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-[var(--color-ink-dim)]">
          {cats.map((c) => (
            <span key={c.slug} className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5">
              {c.emoji} {c.slug}
            </span>
          ))}
        </div>
      </div>

      {parsed.length > 0 && (
        <p className="text-sm text-[var(--color-ink-dim)]">
          {validCount} valid item{validCount === 1 ? "" : "s"}
          {parsed.length - validCount > 0 && ` · ${parsed.length - validCount} invalid (bad food-slug or no dish)`}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy || !placeName.trim() || validCount === 0}
        className="rounded-lg bg-[var(--color-brand)] px-5 py-2.5 font-semibold text-white transition hover:bg-[var(--color-brand-soft)] disabled:opacity-50"
      >
        {busy ? "Importing…" : `Import ${validCount} dish${validCount === 1 ? "" : "es"} (unranked)`}
      </button>

      {error && <p className="text-sm text-[var(--color-brand-soft)]">{error}</p>}
      {result && (
        <div className="rounded-lg border border-[var(--color-good)]/40 bg-[var(--color-good)]/5 p-3 text-sm">
          <p className="font-semibold text-[var(--color-good)]">
            ✓ Added {result.added} · skipped {result.skipped}
          </p>
          {result.skips.length > 0 && (
            <ul className="mt-1 list-inside list-disc text-xs text-[var(--color-ink-dim)]">
              {result.skips.slice(0, 8).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
