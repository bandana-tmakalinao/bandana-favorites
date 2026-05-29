"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { btn } from "./bits";

export default function PinButton({
  contenderId,
  signedIn,
  initialPinned,
}: {
  contenderId: string;
  signedIn: boolean;
  initialPinned: boolean;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);

  if (!signedIn) return null;

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/pinnacle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenderId, action: pinned ? "remove" : "add" }),
      });
      if (res.ok) {
        setPinned(!pinned);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={toggle} disabled={busy} className={btn(pinned ? "primary" : "secondary")}>
      {pinned ? "★ In your favorites" : "☆ Add to favorites"}
    </button>
  );
}
