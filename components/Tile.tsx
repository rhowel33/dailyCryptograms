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
  const colorClass = solved ? "text-cryptoBlue" : "text-slate-900";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`Cipher letter ${encChar}, current guess ${showLetter || "empty"}`}
      className={`relative flex h-14 w-10 sm:h-16 sm:w-12 flex-col items-center justify-between
                  rounded-md border-2 px-1 pb-1 pt-2
                  font-serif transition-shadow select-none
                  ${selected ? "border-amber-700 shadow-md ring-2 ring-amber-500" : "border-amber-400"}
                  bg-tile-face`}
      style={{
        boxShadow: selected
          ? "0 2px 0 #a47a3a, 0 4px 8px rgba(0,0,0,0.18)"
          : "0 2px 0 #caa86a",
      }}
    >
      <span
        className={`text-xl sm:text-2xl font-semibold leading-none ${colorClass} ${
          solved ? "tile-pop" : ""
        }`}
        key={`${encChar}-${showLetter}`}
      >
        {showLetter || " "}
      </span>
      <span className="text-[10px] sm:text-xs uppercase tracking-wider text-amber-900/70">
        {encChar}
      </span>
    </button>
  );
}

export default memo(TileImpl);
