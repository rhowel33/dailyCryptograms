"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Tile from "./Tile";
import WinModal from "./WinModal";
import Keyboard from "./Keyboard";
import {
  msUntilLocalMidnight,
  todaysPuzzle,
  type Puzzle,
} from "@/lib/daily";
import { loadProgress, saveProgress, type SavedProgress } from "@/lib/storage";

type Token =
  | { kind: "letter"; ch: string; index: number } // ch is uppercase encrypted A-Z
  | { kind: "punct"; ch: string }
  | { kind: "space" };

function tokenize(encrypted: string): Token[] {
  const tokens: Token[] = [];
  let letterIndex = 0;
  for (const ch of encrypted) {
    const upper = ch.toUpperCase();
    if (upper >= "A" && upper <= "Z") {
      tokens.push({ kind: "letter", ch: upper, index: letterIndex++ });
    } else if (ch === " ") {
      tokens.push({ kind: "space" });
    } else {
      tokens.push({ kind: "punct", ch });
    }
  }
  return tokens;
}

function groupIntoWords(tokens: Token[]): Token[][] {
  const words: Token[][] = [];
  let current: Token[] = [];
  for (const t of tokens) {
    if (t.kind === "space") {
      if (current.length) words.push(current);
      current = [];
    } else {
      current.push(t);
    }
  }
  if (current.length) words.push(current);
  return words;
}

export default function Cryptogram() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [guess, setGuess] = useState<Record<string, string>>({}); // enc -> guessed plain
  const [hints, setHints] = useState(0);
  const [selectedEnc, setSelectedEnc] = useState<string | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [solved, setSolved] = useState(false);
  const winShownRef = useRef(false);

  // On mount: load today's puzzle and any saved progress.
  useEffect(() => {
    const p = todaysPuzzle();
    setPuzzle(p);
    const saved = loadProgress(p.dateKey);
    if (saved) {
      setGuess(saved.guess ?? {});
      setHints(saved.hints ?? 0);
      setSolved(saved.solved ?? false);
      winShownRef.current = saved.solved ?? false;
    }
  }, []);

  // Roll over to the next day's puzzle automatically at local midnight.
  useEffect(() => {
    if (!puzzle) return;
    const t = window.setTimeout(() => {
      const next = todaysPuzzle();
      if (next.dateKey !== puzzle.dateKey) {
        setPuzzle(next);
        setGuess({});
        setHints(0);
        setSolved(false);
        winShownRef.current = false;
        setShowWin(false);
        setSelectedEnc(null);
        const saved = loadProgress(next.dateKey);
        if (saved) {
          setGuess(saved.guess);
          setHints(saved.hints);
          setSolved(saved.solved);
          winShownRef.current = saved.solved;
        }
      }
    }, msUntilLocalMidnight() + 500);
    return () => window.clearTimeout(t);
  }, [puzzle]);

  // Persist progress per day.
  useEffect(() => {
    if (!puzzle) return;
    const data: SavedProgress = {
      dateKey: puzzle.dateKey,
      guess,
      hints,
      solved,
    };
    saveProgress(data);
  }, [puzzle, guess, hints, solved]);

  const encLettersInPuzzle = useMemo(() => {
    if (!puzzle) return new Set<string>();
    const set = new Set<string>();
    for (const ch of puzzle.encrypted) {
      const upper = ch.toUpperCase();
      if (upper >= "A" && upper <= "Z") set.add(upper);
    }
    return set;
  }, [puzzle]);

  // Detect win.
  useEffect(() => {
    if (!puzzle) return;
    let allCorrect = encLettersInPuzzle.size > 0;
    for (const enc of encLettersInPuzzle) {
      if (guess[enc] !== puzzle.cipher[enc]) {
        allCorrect = false;
        break;
      }
    }
    if (allCorrect && !winShownRef.current) {
      setSolved(true);
      setShowWin(true);
      winShownRef.current = true;
    }
  }, [guess, encLettersInPuzzle, puzzle]);

  const tokens = useMemo(() => (puzzle ? tokenize(puzzle.encrypted) : []), [puzzle]);
  const words = useMemo(() => groupIntoWords(tokens), [tokens]);

  const usedGuesses = useMemo(() => {
    const s = new Set<string>();
    for (const v of Object.values(guess)) if (v) s.add(v);
    return s;
  }, [guess]);

  const advanceSelection = useCallback(
    (direction: 1 | -1) => {
      if (!puzzle) return;
      const letterTokens = tokens.filter((t) => t.kind === "letter") as Extract<
        Token,
        { kind: "letter" }
      >[];
      if (!letterTokens.length) return;
      const currentIdx = letterTokens.findIndex((t) => t.ch === selectedEnc);
      let i = currentIdx === -1 ? 0 : currentIdx + direction;
      for (let step = 0; step < letterTokens.length; step++) {
        const wrapped = ((i % letterTokens.length) + letterTokens.length) % letterTokens.length;
        const candidate = letterTokens[wrapped];
        if (guess[candidate.ch] !== puzzle.cipher[candidate.ch]) {
          setSelectedEnc(candidate.ch);
          return;
        }
        i += direction;
      }
    },
    [tokens, selectedEnc, guess, puzzle]
  );

  const handleKey = useCallback(
    (key: string) => {
      if (!puzzle) return;
      if (key === "BACKSPACE") {
        if (selectedEnc) {
          setGuess((prev) => {
            const next = { ...prev };
            delete next[selectedEnc];
            return next;
          });
          advanceSelection(-1);
        }
        return;
      }
      const k = key.toUpperCase();
      if (!/^[A-Z]$/.test(k)) return;
      if (!selectedEnc) {
        for (const enc of encLettersInPuzzle) {
          if (guess[enc] !== puzzle.cipher[enc]) {
            setSelectedEnc(enc);
            break;
          }
        }
        return;
      }
      setGuess((prev) => {
        // assigning a letter that's already used elsewhere clears the old slot
        const next: Record<string, string> = {};
        for (const [enc, val] of Object.entries(prev)) {
          if (val !== k) next[enc] = val;
        }
        next[selectedEnc] = k;
        return next;
      });
      advanceSelection(1);
    },
    [puzzle, selectedEnc, guess, encLettersInPuzzle, advanceSelection]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (showWin) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Backspace") {
        e.preventDefault();
        handleKey("BACKSPACE");
      } else if (e.key === "ArrowRight" || e.key === "Tab") {
        e.preventDefault();
        advanceSelection(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        advanceSelection(-1);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleKey(e.key);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey, advanceSelection, showWin]);

  const handleHint = useCallback(() => {
    if (!puzzle) return;
    const unsolved: string[] = [];
    for (const enc of encLettersInPuzzle) {
      if (guess[enc] !== puzzle.cipher[enc]) unsolved.push(enc);
    }
    if (!unsolved.length) return;
    const pick = unsolved[Math.floor(Math.random() * unsolved.length)];
    setGuess((prev) => {
      const next: Record<string, string> = {};
      const correct = puzzle.cipher[pick];
      for (const [enc, val] of Object.entries(prev)) {
        if (val !== correct) next[enc] = val;
      }
      next[pick] = correct;
      return next;
    });
    setHints((h) => h + 1);
  }, [puzzle, guess, encLettersInPuzzle]);

  const handleClear = useCallback(() => {
    if (!confirm("Clear all your guesses?")) return;
    setGuess({});
    setSelectedEnc(null);
  }, []);

  if (!puzzle) {
    return (
      <div className="mx-auto max-w-3xl text-center text-amber-900/70">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 text-center">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-amber-900">
          Daily Cryptograms
        </h1>
        <p className="mt-1 text-sm text-amber-900/70">
          Today&apos;s quote — {puzzle.dateKey}
        </p>
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={handleHint}
          className="rounded border border-amber-700 bg-amber-100 px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-200"
        >
          Hint
        </button>
        <span className="text-amber-900/70">
          {hints} {hints === 1 ? "hint" : "hints"} used
        </span>
        <span className="mx-2 text-amber-900/30">|</span>
        <button
          type="button"
          onClick={handleClear}
          className="rounded border border-slate-400 bg-white px-3 py-1.5 hover:bg-slate-100"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
        {words.map((word, wi) => (
          <div key={wi} className="flex gap-1">
            {word.map((tok, ti) => {
              if (tok.kind === "punct") {
                return (
                  <div
                    key={ti}
                    className="flex h-14 sm:h-16 items-end pb-2 font-serif text-2xl text-slate-800"
                  >
                    {tok.ch}
                  </div>
                );
              }
              if (tok.kind === "letter") {
                const enc = tok.ch;
                const g = guess[enc];
                const correct = puzzle.cipher[enc];
                const isSolved = g === correct;
                return (
                  <Tile
                    key={ti}
                    encChar={enc}
                    guess={g}
                    selected={selectedEnc === enc}
                    solved={isSolved}
                    index={tok.index}
                    onSelect={() => setSelectedEnc(enc)}
                  />
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      <Keyboard onKey={handleKey} usedGuesses={usedGuesses} />

      <p className="mt-6 text-center text-xs text-amber-900/60">
        Click a tile, then type the letter you think it stands for. Same letter
        always maps to the same letter throughout the quote.
      </p>

      {showWin && (
        <WinModal
          quote={puzzle.quote}
          hints={hints}
          onClose={() => setShowWin(false)}
        />
      )}
    </div>
  );
}
