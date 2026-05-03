"use client";

import { memo } from "react";

type Props = {
  encChar: string; // single uppercase A-Z
  guess: string | undefined; // uppercase A-Z or undefined
  selected: boolean;
  solved: boolean;
  onSelect: () => void;
  index: number;
};

function TileImpl({ encChar, guess, selected, solved, onSelect }: Props) {
  const showLetter = guess ?? "";
  const letterColorClass = solved
    ? "text-[color:var(--tile-text-solved)]"
    : "text-[color:var(--tile-text)]";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Cipher letter ${encChar}, current guess ${showLetter || "empty"}`}
      className={`relative flex h-14 w-10 sm:h-16 sm:w-12 flex-col items-center justify-between
                  rounded-md border-2 px-1 pb-1 pt-2
                  font-serif transition-shadow select-none
                  bg-[color:var(--tile-face)]
                  ${
                    selected
                      ? "border-[color:var(--tile-border-active)] shadow-md ring-2 ring-[color:var(--accent-ring)]"
                      : "border-[color:var(--tile-border)]"
                  }`}
      style={{
        boxShadow: selected
          ? "0 2px 0 var(--tile-shadow), 0 4px 8px rgba(0,0,0,0.18)"
          : "0 2px 0 var(--tile-edge)",
      }}
    >
      <span
        className={`text-xl sm:text-2xl font-semibold leading-none ${letterColorClass} ${
          solved ? "tile-pop" : ""
        }`}
        key={`${encChar}-${showLetter}`}
      >
        {showLetter || " "}
      </span>
      <span className="text-[10px] sm:text-xs uppercase tracking-wider text-[color:var(--tile-label)]">
        {encChar}
      </span>
    </button>
  );
}

export default memo(TileImpl);
