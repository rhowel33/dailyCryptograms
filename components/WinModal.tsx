"use client";

import type { Quote } from "@/lib/quotes";

type Props = {
  quote: Quote;
  hints: number;
  onClose: () => void;
};

export default function WinModal({ quote, hints, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-w-xl rounded-lg bg-black p-6 sm:p-8 text-white shadow-xl"
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
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/40 px-4 py-2 hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
