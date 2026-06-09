"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share a ranking as an Instagram-ready image. Opens a sheet with a live preview of the generated
 * 1080×1350 poster, then offers: native share (Web Share API with the image FILE → Instagram /
 * Messages on supporting phones), download the PNG, or copy the page link. The poster itself is
 * produced server-side at /share/[kind]/[id]/image (next/og).
 */
export default function ShareButton({
  kind,
  id,
  title,
  pageHref,
  query,
  label = "Share",
  variant = "solid",
}: {
  kind: "category" | "pinnacle" | "personal" | "dish";
  id: string;
  title: string; // e.g. "Best Pizza in NYC" — used as the native-share text
  pageHref: string; // e.g. /nyc/pizza — the "see the full ranking" link
  query?: string; // extra image query, e.g. "sub=pizza" for a personal per-category share
  label?: string;
  variant?: "solid" | "ghost" | "hero";
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const imgSrc = `/share/${kind}/${id}/image${query ? `?${query}` : ""}`;
  const fileName = `${id}-bandana-faves.png`;

  // While the sheet is open: lock body scroll, close on Escape, move focus into the dialog;
  // on close, restore focus to the trigger so keyboard users land where they left off.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  async function fetchBlob(): Promise<Blob> {
    const res = await fetch(imgSrc);
    if (!res.ok) throw new Error("image");
    return res.blob();
  }

  function triggerDownload(blob: Blob) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }

  async function nativeShare() {
    setBusy(true);
    setNote(null);
    try {
      const blob = await fetchBlob();
      const file = new File([blob], fileName, { type: "image/png" });
      const url = typeof window !== "undefined" ? window.location.origin + pageHref : pageHref;
      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title, text: `${title} · Bandana Faves`, url });
      } else if (nav.share) {
        await nav.share({ title, text: `${title} · Bandana Faves`, url });
      } else {
        triggerDownload(blob);
        setNote("Image downloaded — post it to your story or feed.");
      }
    } catch (e) {
      // AbortError = user dismissed the native sheet; otherwise fall back to a download.
      if ((e as Error)?.name !== "AbortError") {
        try {
          triggerDownload(await fetchBlob());
          setNote("Image downloaded — post it to your story or feed.");
        } catch {
          setNote("Couldn't generate the image. Try again.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setBusy(true);
    setNote(null);
    try {
      triggerDownload(await fetchBlob());
      setNote("Saved! Open Instagram and post it.");
    } catch {
      setNote("Couldn't generate the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    const url = typeof window !== "undefined" ? window.location.origin + pageHref : pageHref;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setNote(url);
    }
  }

  const trigger =
    variant === "ghost"
      ? "inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)] transition hover:border-[var(--color-ink-dim)]"
      : variant === "hero" // for use ON a poster-gradient band — frosted white
        ? "inline-flex items-center gap-1.5 rounded-xl border border-white/40 bg-white/15 px-4 py-2 font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
        : "inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-soft)]";

  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)} className={trigger} aria-label="Share this ranking">
        <ShareIcon />
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Share this ranking"
            className="w-full max-w-md overflow-hidden rounded-t-3xl border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
              <h3 className="font-black tracking-tight">Share this ranking</h3>
              <button
                ref={closeRef}
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-ink-dim)] transition hover:bg-[var(--color-surface-2)]"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[58vh] overflow-y-auto px-5 py-4">
              {/* live preview of the generated poster (aspect box reserves 4:5 so the modal doesn't jump) */}
              <div
                className="mx-auto w-full max-w-[260px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)] shadow-[0_8px_30px_-14px_rgba(35,28,22,0.45)]"
                style={{ aspectRatio: "1080 / 1350" }}
              >
                {imgFailed ? (
                  <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-[var(--color-ink-dim)]">
                    Preview unavailable — you can still share or copy the link below.
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc}
                    alt={`${title} — shareable ranking`}
                    width={1080}
                    height={1350}
                    className="block h-full w-full object-cover"
                    onError={() => setImgFailed(true)}
                  />
                )}
              </div>
              <p className="mt-3 text-center text-xs text-[var(--color-ink-dim)]">
                A 1080×1350 image, sized perfectly for Instagram.
              </p>
            </div>

            <div className="space-y-2 border-t border-[var(--color-border)] px-5 py-4">
              <button
                onClick={nativeShare}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-brand)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--color-brand-soft)] disabled:opacity-60"
              >
                <ShareIcon />
                {busy ? "Preparing…" : "Share to Instagram & more"}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={download}
                  disabled={busy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--color-ink-dim)] disabled:opacity-60"
                >
                  ⬇ Download
                </button>
                <button
                  onClick={copyLink}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--color-ink-dim)]"
                >
                  {copied ? "✓ Copied" : "🔗 Copy link"}
                </button>
              </div>
              {note && <p className="pt-1 text-center text-xs text-[var(--color-ink-dim)]">{note}</p>}
              <a
                href={pageHref}
                className="block pt-1 text-center text-sm font-semibold text-[var(--color-brand)] hover:underline"
              >
                See the full ranking →
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3v13M12 3l-4 4M12 3l4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
