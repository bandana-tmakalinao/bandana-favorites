"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function PhotoUpload({ contenderId, signedIn }: { contenderId: string; signedIn: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!signedIn) return null;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("contenderId", contenderId);
      const res = await fetch("/api/photos", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Upload failed.");
        return;
      }
      setMsg("Added — pending community verification.");
      router.refresh();
    } catch {
      setMsg("Network error.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="text-sm">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-[var(--color-ink-dim)] transition hover:border-[var(--color-ink-dim)] disabled:opacity-50"
      >
        {busy ? "Uploading…" : "📷 Add a photo"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onPick}
      />
      {msg && <span className="ml-2 text-xs text-[var(--color-ink-dim)]">{msg}</span>}
    </div>
  );
}
