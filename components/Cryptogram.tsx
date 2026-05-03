"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Tile from "./Tile";
import WinModal from "./WinModal";
import Keyboard from "./Keyboard";
import ThemePicker from "./ThemePicker";
import {
  isPuzzleReleased,
  localDateKey,
  msUntilLocalMidnight,
  puzzleByNumber,
  todaysPuzzle,
  type Puzzle,
} from "@/lib/daily";
import { loadProgress, saveProgress, type SavedProgress } from "@/lib/storage";
import {
  effectiveCurrent,
  loadStreak,
  recordSolve,
  type StreakData,
} from "@/lib/streak";

type Props = {
  // When provided, render that archive puzzle instead of today's daily.
  puzzleNumber?: number;
};

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

export default function Cryptogram({ puzzleNumber }: Props = {}) {
  const isArchive = puzzleNumber !== undefined;
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [guess, setGuess] = useState<Record<string, string>>({}); // enc -> guessed plain
  const [hints, setHints] = useState(0);
  const [selectedEnc, setSelectedEnc] = useState<string | null>(null);
  // Position of the most-recently-targeted tile (token index, sequential A-Z order).
  // Used to anchor cursor advancement so typing flows position-by-position rather
  // than jumping to the first occurrence of `selectedEnc` in the puzzle.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showWin, setShowWin] = useState(false);
  const [solved, setSolved] = useState(false);
  // Unix-ms of first interaction; null until the user types or hints.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Final solve time, frozen at the moment of solve.
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [streak, setStreak] = useState<StreakData>({
    current: 0,
    longest: 0,
    lastSolvedDate: null,
  });
  // Archive lock state: "checking" until we've verified release on the client
  // (the static build can't know the user's local "today"), then "released" or "locked".
  const [archiveStatus, setArchiveStatus] = useState<
    "checking" | "released" | "locked"
  >(isArchive ? "checking" : "released");
  const winShownRef = useRef(false);

  // Load streak on mount.
  useEffect(() => {
    setStreak(loadStreak());
  }, []);

  // Record a solve into the streak when the daily puzzle is solved.
  // Archive puzzles (dateKey starts with "archive-") never affect the streak.
  useEffect(() => {
    if (!puzzle || isArchive || !solved) return;
    if (puzzle.dateKey !== localDateKey()) return;
    setStreak(recordSolve(puzzle.dateKey));
  }, [puzzle, isArchive, solved]);

  // On mount (or when puzzleNumber changes): load the puzzle and any saved progress.
  useEffect(() => {
    if (isArchive) {
      if (!isPuzzleReleased(puzzleNumber!)) {
        setArchiveStatus("locked");
        setPuzzle(null);
        return;
      }
      setArchiveStatus("released");
    }
    const p = isArchive ? puzzleByNumber(puzzleNumber!) : todaysPuzzle();
    if (!p) return;
    setPuzzle(p);
    setGuess({});
    setHints(0);
    setSolved(false);
    winShownRef.current = false;
    setShowWin(false);
    setSelectedEnc(null);
    setSelectedIndex(null);
    setStartedAt(null);
    setDurationMs(null);
    const saved = loadProgress(p.dateKey, p.encrypted);
    if (saved) {
      setGuess(saved.guess ?? {});
      setHints(saved.hints ?? 0);
      setSolved(saved.solved ?? false);
      setStartedAt(saved.startedAt ?? null);
      setDurationMs(saved.durationMs ?? null);
      winShownRef.current = saved.solved ?? false;
    }
  }, [puzzleNumber, isArchive]);

  // Roll over to the next day's puzzle automatically at local midnight.
  // Only applies to the daily mode — archive puzzles are pinned by number.
  useEffect(() => {
    if (!puzzle || isArchive) return;
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
        setSelectedIndex(null);
        setStartedAt(null);
        setDurationMs(null);
        const saved = loadProgress(next.dateKey, next.encrypted);
        if (saved) {
          setGuess(saved.guess);
          setHints(saved.hints);
          setSolved(saved.solved);
          setStartedAt(saved.startedAt ?? null);
          setDurationMs(saved.durationMs ?? null);
          winShownRef.current = saved.solved;
        }
      }
    }, msUntilLocalMidnight() + 500);
    return () => window.clearTimeout(t);
  }, [puzzle, isArchive]);

  // Persist progress per day.
  useEffect(() => {
    if (!puzzle) return;
    const data: SavedProgress = {
      dateKey: puzzle.dateKey,
      guess,
      hints,
      solved,
      encrypted: puzzle.encrypted,
      startedAt,
      durationMs,
    };
    saveProgress(data);
  }, [puzzle, guess, hints, solved, startedAt, durationMs]);

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
      // Freeze final solve time. Use the function form so we don't overwrite
      // a duration already loaded from storage (in case of reload-after-solve).
      setDurationMs((prev) => {
        if (prev !== null) return prev;
        if (startedAt === null) return null;
        return Date.now() - startedAt;
      });
    }
  }, [guess, encLettersInPuzzle, puzzle, startedAt]);

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
      // Anchor on the actual selected position, not the first occurrence of
      // selectedEnc — the same enc letter can appear in many positions.
      const startIdx = selectedIndex ?? -1;
      let i = startIdx === -1 ? 0 : startIdx + direction;
      for (let step = 0; step < letterTokens.length; step++) {
        const wrapped = ((i % letterTokens.length) + letterTokens.length) % letterTokens.length;
        const candidate = letterTokens[wrapped];
        // Land on the next empty cell so typing a known word flows naturally.
        if (!guess[candidate.ch]) {
          setSelectedEnc(candidate.ch);
          setSelectedIndex(candidate.index);
          return;
        }
        i += direction;
      }
    },
    [tokens, selectedIndex, guess, puzzle]
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
      // Start the solve timer on the first real input (after we've established
      // a selection and we're about to commit a letter).
      setStartedAt((prev) => prev ?? Date.now());
      if (!selectedEnc) {
        // Pick the first empty position in puzzle order.
        const firstEmpty = tokens.find(
          (t): t is Extract<Token, { kind: "letter" }> =>
            t.kind === "letter" && !guess[t.ch]
        );
        if (firstEmpty) {
          setSelectedEnc(firstEmpty.ch);
          setSelectedIndex(firstEmpty.index);
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
    [puzzle, selectedEnc, guess, tokens, advanceSelection]
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
    setStartedAt((prev) => prev ?? Date.now());
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
    setSelectedIndex(null);
    setStartedAt(null);
    setDurationMs(null);
  }, []);

  if (isArchive && archiveStatus === "locked") {
    return (
      <div className="mx-auto max-w-xl text-center">
        <h1 className="font-serif text-2xl sm:text-3xl tracking-tight text-[color:var(--accent)]">
          Cryptogram #{puzzleNumber}
        </h1>
        <p className="mt-4 text-[color:var(--ink-muted)]">
          This puzzle hasn&apos;t been released yet — check back on the day it&apos;s scheduled.
        </p>
        <p className="mt-6">
          <a
            href="/"
            className="underline text-[color:var(--accent)] hover:opacity-80"
          >
            ← Back to today&apos;s puzzle
          </a>
        </p>
      </div>
    );
  }

  if (!puzzle) {
    return (
      <div className="mx-auto max-w-3xl text-center text-[color:var(--ink-muted)]">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 text-center">
        <div className="flex justify-end mb-2">
          <ThemePicker />
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight text-[color:var(--accent)]">
          Daily Cryptograms
        </h1>
        <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
          {isArchive
            ? `Cryptogram #${puzzle.number}`
            : `Today's quote — ${puzzle.dateKey} · #${puzzle.number}`}
        </p>
        {!isArchive && (
          <p className="mt-2 text-xs text-[color:var(--ink-muted)]">
            Streak:{" "}
            <span className="font-semibold">
              {effectiveCurrent(streak, puzzle.dateKey)}
            </span>
            {streak.longest > 0 && (
              <span className="text-[color:var(--ink-soft)]">
                {" "}
                · best {streak.longest}
              </span>
            )}
          </p>
        )}
        {isArchive && (
          <p className="mt-1 text-xs">
            <a
              href="/"
              className="text-[color:var(--ink-muted)] underline hover:text-[color:var(--accent)]"
            >
              ← Back to today&apos;s puzzle
            </a>
          </p>
        )}
      </header>

      <div className="mb-5 flex flex-wrap items-center justify-center gap-2 text-sm">
        <button
          type="button"
          onClick={handleHint}
          className="rounded border px-3 py-1.5 font-semibold
                     border-[color:var(--accent-border)]
                     bg-[color:var(--accent-bg)]
                     text-[color:var(--accent)]
                     hover:bg-[color:var(--accent-bg-hover)]"
        >
          Hint
        </button>
        <span className="text-[color:var(--ink-muted)]">
          {hints} {hints === 1 ? "hint" : "hints"} used
        </span>
        <span className="mx-2 text-[color:var(--ink-hint)]">|</span>
        <button
          type="button"
          onClick={handleClear}
          className="rounded border px-3 py-1.5
                     border-[color:var(--secondary-border)]
                     bg-[color:var(--secondary-bg)]
                     text-[color:var(--ink)]
                     hover:bg-[color:var(--secondary-bg-hover)]"
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
                    className="flex h-14 sm:h-16 items-end pb-2 font-serif text-2xl text-[color:var(--punct)]"
                  >
                    {tok.ch}
                  </div>
                );
              }
              if (tok.kind === "letter") {
                const enc = tok.ch;
                const g = guess[enc];
                return (
                  <Tile
                    key={ti}
                    encChar={enc}
                    guess={g}
                    selected={selectedEnc === enc}
                    index={tok.index}
                    onSelect={() => {
                      setSelectedEnc(enc);
                      setSelectedIndex(tok.index);
                    }}
                  />
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      <Keyboard onKey={handleKey} usedGuesses={usedGuesses} />

      <p className="mt-6 text-center text-xs text-[color:var(--ink-soft)]">
        Click a tile, then type the letter you think it stands for. Same letter
        always maps to the same letter throughout the quote.
      </p>

      {showWin && (
        <WinModal
          quote={puzzle.quote}
          hints={hints}
          puzzleNumber={puzzle.number}
          durationMs={durationMs}
          streak={isArchive ? null : effectiveCurrent(streak, puzzle.dateKey)}
          onClose={() => setShowWin(false)}
        />
      )}
    </div>
  );
}
