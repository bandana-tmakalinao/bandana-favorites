"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { btn } from "./bits";

interface SubOpt {
  slug: string;
  name: string;
  emoji: string;
}
interface CatGroup {
  name: string;
  emoji: string;
  subs: SubOpt[];
}

const inputCls =
  "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]";

export default function AddDishHere({
  placeId,
  groups,
  signedIn,
  existing = {},
  initialSub,
}: {
  placeId: string;
  groups: CatGroup[];
  signedIn: boolean;
  existing?: Record<string, { id: string; title: string }[]>; // dishes already logged here, per food type
  initialSub?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!initialSub);
  const [sub, setSub] = useState(initialSub ?? "");
  const [dish, setDish] = useState("");
  const [note, setNote] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [hint, setHint] = useState<{ decision: string; suggestion: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Load the chosen food type's existing dish names for autocomplete.
  useEffect(() => {
    if (!sub) {
      setNames([]);
      return;
    }
    let live = true;
    fetch(`/api/dishes/list?sub=${sub}`)
      .then((r) => r.json())
      .then((d) => live && setNames(d.names ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sub]);

  // Live dedupe suggestion against the chosen food type's vocabulary.
  useEffect(() => {
    const term = dish.trim();
    if (!sub || term.length < 2) {
      setHint(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/dishes/match?sub=${sub}&q=${encodeURIComponent(term)}`);
        const d = await r.json();
        setHint(d.suggestion && d.suggestion.toLowerCase() !== term.toLowerCase() ? d : null);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => clearTimeout(t);
  }, [dish, sub]);

  async function submit() {
    if (!sub) {
      setMsg("Pick a food type first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/contenders/add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId, sub, title: dish, description: note }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error ?? "Couldn't add.");
        return;
      }
      // Straight into placing the new dish against what you've already ranked (tried-gated).
      router.push(`/duel?sub=${sub}&target=${d.contenderId}`);
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
    }
  }

  if (!signedIn) {
    return (
      <Link
        href={`/me?returnTo=${encodeURIComponent(`/p/${placeId}`)}`}
        className="inline-block rounded-xl border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-dim)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]"
      >
        Sign in to add a dish here →
      </Link>
    );
  }

  const already = sub ? existing[sub] : undefined;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-ink-dim)] transition hover:border-[var(--color-brand)] hover:text-[var(--color-ink)]"
      >
        + Add a dish you had here
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">What did you have here?</span>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]">
          Close
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Food type</label>
          <select value={sub} onChange={(e) => setSub(e.target.value)} className={inputCls}>
            <option value="">Pick a food type…</option>
            {groups.map((g) => (
              <optgroup key={g.name} label={`${g.emoji} ${g.name}`}>
                {g.subs.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.emoji} {s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {already && already.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
            <p className="mb-1.5 text-xs text-[var(--color-ink-dim)]">
              Already logged here — rate them, or add another below:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {already.map((d) => (
                <Link
                  key={d.id}
                  href={`/c/${d.id}`}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs transition hover:border-[var(--color-brand)]"
                >
                  {d.title} · rate →
                </Link>
              ))}
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">Dish name</label>
          <input
            value={dish}
            onChange={(e) => setDish(e.target.value)}
            list="bf-here-dishes"
            placeholder={names[0] ? `e.g. ${names[0]}` : "What's it called on the menu?"}
            disabled={!sub}
            className={inputCls}
          />
          <datalist id="bf-here-dishes">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {hint?.suggestion && (
            <button
              type="button"
              onClick={() => {
                setDish(hint.suggestion as string);
                setHint(null);
              }}
              className="mt-1.5 text-sm text-[var(--color-brand)] hover:underline"
            >
              {hint.decision === "snap" ? "We already list this as" : "Did you mean"}{" "}
              <span className="font-semibold">“{hint.suggestion}”</span>? Use it →
            </button>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A few words of detail" className={inputCls} />
        </div>

        <div className="flex items-center gap-2">
          <button onClick={submit} disabled={busy || !sub || !dish.trim()} className={btn("primary")}>
            {busy ? "Adding…" : "Add & rate it"}
          </button>
          {msg && <span className="text-xs text-[var(--color-ink-dim)]">{msg}</span>}
        </div>
      </div>
    </div>
  );
}
