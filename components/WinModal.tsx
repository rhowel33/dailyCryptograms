"use client";

import { useState } from "react";
import type { Quote } from "@/lib/quotes";

type Props = {
  quote: Quote;
  hints: number;
  puzzleNumber: number;
  // Final solve duration in ms. null if the puzzle was solved in a prior
  // session before the timer was wired up, or if startedAt was never recorded.
  durationMs: number | null;
  // Current daily streak after this solve. null when not applicable (archive mode).
  streak: number | null;
  onClose: () => void;
};

// Always link to the canonical production domain — the share text is intended
// to be sent to other people, who shouldn't see localhost or tunnel hostnames.
const SHARE_DOMAIN = "dailycryptograms.com";

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

function buildShareText(
  puzzleNumber: number,
  hints: number,
  durationMs: number | null
): string {
  const url = `${SHARE_DOMAIN}/archive/${puzzleNumber}`;
  const time = durationMs !== null ? formatDuration(durationMs) : "—";
  const hintLabel = hints === 1 ? "hint" : "hints";
  return `Daily Cryptograms #${puzzleNumber}: ${time}, ${hints} ${hintLabel}\n${url}`;
}

export default function WinModal({
  quote,
  hints,
  puzzleNumber,
  durationMs,
  streak,
  onClose,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = buildShareText(puzzleNumber, hints, durationMs);

    // Prefer the native share sheet on mobile; otherwise copy to clipboard.
    // Intentionally do NOT pass a `url` field: Safari (macOS + iOS) prioritises
    // the URL over `text` for many share targets (Messages, Notes, Mail, Copy),
    // dropping the rest of the blurb. The URL is already embedded in `text`,
    // so every destination gets the complete payload.
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: `Daily Cryptograms #${puzzleNumber}`, text });
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await nav?.clipboard?.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — leave UI as-is
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "var(--modal-overlay)" }}
      onClick={onClose}
    >
      <div
        className="max-w-xl rounded-lg p-6 sm:p-8 shadow-xl
                   bg-[color:var(--modal-bg)] text-[color:var(--modal-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-semibold italic">Congratulations!</h2>
        <p className="mt-4 text-lg italic leading-relaxed">
          {quote.text}{" "}
          <span className="whitespace-nowrap">— {quote.author}</span>
        </p>
        <p className="mt-6 italic">Well done. Come back tomorrow for a new quote.</p>
        {durationMs !== null && (
          <p className="mt-2 italic">Solved in {formatDuration(durationMs)}.</p>
        )}
        <p className="mt-2 italic">
          You used {hints} {hints === 1 ? "hint" : "hints"}.
        </p>
        {streak !== null && streak > 0 && (
          <p className="mt-2 italic">
            Daily streak: {streak} {streak === 1 ? "day" : "days"}.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleShare}
            className="rounded border px-4 py-2
                       border-[color:var(--modal-btn-border)]
                       bg-[color:var(--modal-btn-bg)]
                       hover:bg-[color:var(--modal-btn-bg-hover)]"
          >
            {copied ? "Copied!" : "Share result"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded border px-4 py-2
                       border-[color:var(--modal-btn-border)]
                       hover:bg-[color:var(--modal-btn-bg)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
