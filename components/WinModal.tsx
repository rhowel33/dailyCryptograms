"use client";

import { useState } from "react";
import type { Quote } from "@/lib/quotes";

type Props = {
  quote: Quote;
  hints: number;
  puzzleNumber: number;
  // Current daily streak after this solve. null when not applicable (archive mode).
  streak: number | null;
  onClose: () => void;
};

function buildShareText(puzzleNumber: number, hints: number, url: string): string {
  const hintLine =
    hints === 0
      ? "Solved with no hints"
      : `Solved with ${hints} ${hints === 1 ? "hint" : "hints"}`;
  return `Daily Cryptogram #${puzzleNumber}\n${hintLine}\n${url}`;
}

export default function WinModal({ quote, hints, puzzleNumber, streak, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/archive/${puzzleNumber}`;
    const text = buildShareText(puzzleNumber, hints, url);

    // Prefer the native share sheet on mobile; otherwise copy to clipboard.
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: `Daily Cryptogram #${puzzleNumber}`, text, url });
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
