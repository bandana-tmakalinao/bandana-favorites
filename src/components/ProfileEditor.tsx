"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, btn } from "./bits";

export default function ProfileEditor({
  name: initName,
  bio: initBio,
  avatarUrl,
  showcase: initShowcase,
  cats,
}: {
  name: string;
  bio: string;
  avatarUrl: string | null;
  showcase: string[];
  cats: { slug: string; name: string; emoji: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initName);
  const [bio, setBio] = useState(initBio);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [showcase, setShowcase] = useState<string[]>(initShowcase);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const input =
    "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 outline-none focus:border-[var(--color-brand)]";

  function toggleCat(slug: string) {
    setShowcase((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : s.length >= 8 ? s : [...s, slug]));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, bio, showcase }),
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
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const d = await r.json();
      if (r.ok) {
        setAvatar(d.url);
        router.refresh();
      } else setMsg(d.error ?? "Upload failed.");
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
          Change photo
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onAvatar} />
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
          placeholder="Your taste in a sentence — what you live for, what you skip."
          className={`${input} resize-none`}
        />
        <div className="mt-0.5 text-right text-[10px] text-[var(--color-ink-dim)]">{bio.length}/280</div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Showcase categories <span className="text-[var(--color-ink-dim)]">({showcase.length}/8)</span>
        </label>
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

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className={btn("primary")}>
          {busy ? "Saving…" : "Save profile"}
        </button>
        {msg && <span className="text-xs text-[var(--color-ink-dim)]">{msg}</span>}
      </div>
    </div>
  );
}
