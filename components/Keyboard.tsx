"use client";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

type Props = {
  onKey: (k: string) => void;
  // letters that have already been used as a guess somewhere
  usedGuesses: Set<string>;
};

export default function Keyboard({ onKey, usedGuesses }: Props) {
  return (
    <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col items-center gap-1.5">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1.5">
          {row.split("").map((k) => {
            const used = usedGuesses.has(k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => onKey(k)}
                className={`h-11 w-8 sm:w-9 rounded border text-sm font-semibold
                            border-[color:var(--key-border)]
                            ${
                              used
                                ? "bg-[color:var(--key-used-bg)] text-[color:var(--key-used-text)]"
                                : "bg-[color:var(--key-bg)] text-[color:var(--ink)] hover:bg-[color:var(--key-bg-hover)]"
                            }`}
              >
                {k}
              </button>
            );
          })}
          {ri === 2 && (
            <button
              type="button"
              onClick={() => onKey("BACKSPACE")}
              className="h-11 rounded border px-3 text-xs font-semibold
                         border-[color:var(--key-border)]
                         bg-[color:var(--key-bg)]
                         text-[color:var(--ink)]
                         hover:bg-[color:var(--key-bg-hover)]"
            >
              ⌫
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
