import type { ConfidenceTier } from "@/lib/config";

/** Consistent button classes for both <button> and <Link>. */
export function btn(variant: "primary" | "secondary" | "ghost" = "primary"): string {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed";
  if (variant === "secondary")
    return `${base} border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-ink-dim)]`;
  if (variant === "ghost") return `${base} text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]`;
  return `${base} bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-soft)]`;
}

const TIER: Record<ConfidenceTier, { label: string; dot: string; text: string }> = {
  established: { label: "Established", dot: "bg-[var(--color-good)]", text: "text-[var(--color-good)]" },
  rising: { label: "Rising", dot: "bg-[var(--color-gold)]", text: "text-[#b57e12]" },
  provisional: { label: "Provisional", dot: "bg-[var(--color-ink-dim)]", text: "text-[var(--color-ink-dim)]" },
};

export function ConfidenceDot({ tier, withLabel = false }: { tier: ConfidenceTier; withLabel?: boolean }) {
  const t = TIER[tier];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${t.dot}`} aria-hidden />
      {withLabel && <span className={`text-xs ${t.text}`}>{t.label}</span>}
    </span>
  );
}

export function tierLabel(tier: ConfidenceTier): string {
  return TIER[tier].label;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-[var(--color-good)] border-[var(--color-good)]/45";
  if (score >= 60) return "text-[var(--color-ink)] border-[var(--color-gold)]/60";
  return "text-[var(--color-ink-dim)] border-[var(--color-border)]";
}

export function ScoreBadge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const pad = size === "lg" ? "h-14 w-14 text-2xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-lg";
  return (
    <span
      className={`grid ${pad} shrink-0 place-items-center rounded-xl border bg-[var(--color-surface)] font-black tabular-nums ${scoreColor(score)}`}
      title="Trust-weighted, shrinkage-adjusted score (0–100)"
    >
      {Math.round(score)}
    </span>
  );
}

/** Round avatar — the user's photo, or a coral monogram fallback. */
export function Avatar({ url, name, size = 44 }: { url: string | null; name: string; size?: number }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-[var(--color-brand)] font-black text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {initial}
    </span>
  );
}

/** Renders a photo when there is one, and NOTHING when there isn't (no empty placeholder blocks). */
export function PhotoThumb({
  url,
  alt,
  className = "",
}: {
  url: string | null;
  alt: string;
  className?: string;
}) {
  if (!url) return null;
  return (
    <span className={`relative block overflow-hidden rounded-lg bg-[var(--color-surface-2)] ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </span>
  );
}
