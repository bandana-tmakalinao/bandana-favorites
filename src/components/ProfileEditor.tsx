"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, btn } from "./bits";

/**
 * Resize + center-crop an image File to a square JPEG data URL, entirely in the browser. Keeps the
 * upload tiny (~20–40KB) so the avatar can be stored inline in the DB — no disk writes (which don't
 * persist on Render's ephemeral filesystem) and no object storage needed.
 */
async function resizeToDataUrl(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const s = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - s) / 2;
  const sy = (bitmap.height - s) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, sx, sy, s, s, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export default function ProfileEditor({
  name: initName,
  bio: initBio,
  avatarUrl,
  showcase: initShowcase,
  expertCategories: initExpert,
  cats,
}: {
  name: string;
  bio: string;
  avatarUrl: string | null;
  showcase: string[];
  expertCategories: string[];
  cats: { slug: string; name: string; emoji: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initName);
  const [bio, setBio] = useState(initBio);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [showcase, setShowcase] = useState<string[]>(initShowcase);
  const [expert, setExpert] = useState<string[]>(initExpert);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const input =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]";

  function toggleCat(slug: string) {
    setShowcase((s) => {
      const next = s.includes(slug) ? s.filter((x) => x !== slug) : s.length >= 8 ? s : [...s, slug];
      // Dropping a category from showcase also drops it from expert (expert ⊆ showcase).
      if (!next.includes(slug)) setExpert((e) => e.filter((x) => x !== slug));
      return next;
    });
  }
  function toggleExpert(slug: string) {
    setExpert((e) =>
      e.includes(slug) ? e.filter((x) => x !== slug) : e.length >= 3 || !showcase.includes(slug) ? e : [...e, slug],
    );
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, bio, showcase, expertCategories: expert }),
      });
      setMsg(r.ok ? "Saved." : "Couldn't save.");
      if (r.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setMsg(null);
    try {
      const dataUrl = await resizeToDataUrl(f, 256);
      const r = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.url) {
        setAvatar(d.url);
        router.refresh();
      } else {
        setMsg(d?.error ?? "Upload failed — try a smaller image.");
      }
    } catch {
      setMsg("Couldn't read that image. Try a JPG or PNG.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-4">
        <Avatar url={avatar} name={name} size={64} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className={btn("secondary")}>
          {busy ? "Working…" : avatar ? "Change photo" : "Add photo"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={input} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={3}
          placeholder="Your taste in a sentence — what you live for, what you skip. (Shown when people find you.)"
          className={`${input} resize-none`}
        />
        <div className="mt-0.5 text-right text-[10px] text-[var(--color-ink-dim)]">{bio.length}/280</div>
      </div>

      {/* Showcase — the categories you rank (≤8) */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          🍽️ Categories you rank <span className="text-[var(--color-ink-dim)]">({showcase.length}/8)</span>
        </label>
        <p className="mb-2 text-xs text-[var(--color-ink-dim)]">
          Categories you feature — your personal ranking and #1 pick show on your profile.
        </p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => {
            const on = showcase.includes(c.slug);
            return (
              <button
                key={c.slug}
                onClick={() => toggleCat(c.slug)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  on
                    ? "border-[var(--color-brand)] font-semibold text-[var(--color-brand)]"
                    : "border-[var(--color-border)] text-[var(--color-ink-dim)] hover:border-[var(--color-ink-dim)]"
                }`}
              >
                {c.emoji} {c.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expert — star up to 3 of the above; these headline your follow card */}
      <div>
        <label className="mb-1 block text-sm font-medium">
          ⭐ Show off as expert <span className="text-[var(--color-ink-dim)]">({expert.length}/3)</span>
        </label>
        <p className="mb-2 text-xs text-[var(--color-ink-dim)]">
          Star up to 3 of the above — these become badges on your follow card so people know what to follow you for.
        </p>
        <div className="flex flex-wrap gap-2">
          {showcase.length === 0 && (
            <span className="text-xs text-[var(--color-ink-dim)]">Pick a category above first.</span>
          )}
          {showcase.map((slug) => {
            const c = cats.find((x) => x.slug === slug);
            if (!c) return null;
            const on = expert.includes(slug);
            const full = expert.length >= 3 && !on;
            return (
              <button
                key={slug}
                onClick={() => toggleExpert(slug)}
                disabled={full}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm transition ${
                  on
                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 font-semibold text-[var(--color-brand-soft)]"
                    : full
                      ? "cursor-not-allowed border-[var(--color-border)] text-[var(--color-ink-dim)]/50"
                      : "border-[var(--color-border)] text-[var(--color-ink-dim)] hover:border-[var(--color-ink-dim)]"
                }`}
              >
                <span aria-hidden>{on ? "⭐" : "☆"}</span> {c.emoji} {c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className={btn("primary")}>
          {busy ? "Saving…" : "Save profile"}
        </button>
        {msg && <span className="text-xs text-[var(--color-ink-dim)]">{msg}</span>}
      </div>
    </div>
  );
}
