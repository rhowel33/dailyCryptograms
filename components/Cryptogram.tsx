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
  pickRandomPuzzleNumber,
  puzzleByNumber,
  puzzleNumberForDate,
  todaysPuzzle,
  type Puzzle,
} from "@/lib/daily";
import {
  clearProgress,
  loadCurrentRandom,
  loadProgress,
  pruneStaleProgress,
  saveCurrentRandom,
  saveProgress,
  type SavedProgress,
} from "@/lib/storage";
import {
  effectiveCurrent,
  loadStreak,
  recordSolve,
  type StreakData,
} from "@/lib/streak";

type Props = {
  // When provided, render that archive puzzle instead of today's daily.
  puzzleNumber?: number;
  // Random mode: read the active puzzle number from localStorage (or pick one
  // and store it on first visit). Mutually exclusive with `puzzleNumber`.
  randomMode?: boolean;
};

// Storage dateKey used for the active /random session. A constant — every
// new random pick clobbers the previous random's saved progress, by design.
const RANDOM_DATE_KEY = "random";

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

export default function Cryptogram({
  puzzleNumber,
  randomMode = false,
}: Props = {}) {
  const isArchive = puzzleNumber !== undefined;
  const isRandom = randomMode;
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
  // Transient note shown next to the hint button (e.g. "already correct").
  const [hintNote, setHintNote] = useState<string | null>(null);
  const hintNoteTimerRef = useRef<number | null>(null);
  // Encrypted letters revealed via Hint. These slots are locked: the player
  // can't backspace, overwrite, or have them displaced by typing the same
  // letter elsewhere — once you've paid for a hint, you keep it.
  const [hintedEncs, setHintedEncs] = useState<Set<string>>(new Set());
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

  // Load streak on mount and prune unreachable past-daily progress entries.
  useEffect(() => {
    setStreak(loadStreak());
    pruneStaleProgress(localDateKey());
  }, []);

  // Record a solve into the streak when the daily puzzle is solved.
  // Archive puzzles (dateKey starts with "archive-") never affect the streak.
  useEffect(() => {
    if (!puzzle || isArchive || !solved) return;
    if (puzzle.dateKey !== localDateKey()) return;
    setStreak(recordSolve(puzzle.dateKey));
  }, [puzzle, isArchive, solved]);

  // On mount (or when puzzleNumber/randomMode changes): load the puzzle and
  // any saved progress.
  useEffect(() => {
    let p: Puzzle | null;
    if (isArchive) {
      if (!isPuzzleReleased(puzzleNumber!)) {
        setArchiveStatus("locked");
        setPuzzle(null);
        return;
      }
      setArchiveStatus("released");
      p = puzzleByNumber(puzzleNumber!);
    } else if (isRandom) {
      // Read the active random pick from localStorage; if none, pick one now
      // and persist it so refreshes stay on the same puzzle.
      let n = loadCurrentRandom();
      if (n === null) {
        n = pickRandomPuzzleNumber();
        if (n === null) return;
        saveCurrentRandom(n);
      }
      const built = puzzleByNumber(n);
      if (!built) return;
      // Override the storage key so all random progress lives under a single
      // localStorage entry that gets clobbered when the user picks again.
      p = { ...built, dateKey: RANDOM_DATE_KEY };
    } else {
      p = todaysPuzzle();
    }
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
    setHintedEncs(new Set());
    const saved = loadProgress(p.dateKey, p.encrypted);
    if (saved) {
      setGuess(saved.guess ?? {});
      setHints(saved.hints ?? 0);
      setSolved(saved.solved ?? false);
      setStartedAt(saved.startedAt ?? null);
      setDurationMs(saved.durationMs ?? null);
      setHintedEncs(new Set(saved.hintedEncs ?? []));
      winShownRef.current = saved.solved ?? false;
    }
  }, [puzzleNumber, isArchive, isRandom]);

  // Roll over to the next day's puzzle automatically at local midnight.
  // Only applies to the daily mode — archive and random puzzles are pinned.
  useEffect(() => {
    if (!puzzle || isArchive || isRandom) return;
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
        setHintedEncs(new Set());
        const saved = loadProgress(next.dateKey, next.encrypted);
        if (saved) {
          setGuess(saved.guess);
          setHints(saved.hints);
          setSolved(saved.solved);
          setStartedAt(saved.startedAt ?? null);
          setDurationMs(saved.durationMs ?? null);
          setHintedEncs(new Set(saved.hintedEncs ?? []));
          winShownRef.current = saved.solved;
        }
      }
    }, msUntilLocalMidnight() + 500);
    return () => window.clearTimeout(t);
  }, [puzzle, isArchive, isRandom]);

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
      hintedEncs: Array.from(hintedEncs),
    };
    saveProgress(data);
  }, [puzzle, guess, hints, solved, startedAt, durationMs, hintedEncs]);

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
    (direction: 1 | -1, skipEnc?: string) => {
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
        // Skip tiles sharing the just-typed enc — `guess` here is the stale
        // pre-update value, so those tiles still look empty even though they
        // were just filled by propagation.
        if (skipEnc !== undefined && candidate.ch === skipEnc) {
          i += direction;
          continue;
        }
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
        if (selectedIndex === null) return;
        // Walk backward (including the current position) until we find a tile
        // with a guess that isn't hinted, clear it, and park the cursor there.
        // Hinted slots are locked, so they're skipped during the walk.
        const letterTokens = tokens.filter(
          (t): t is Extract<Token, { kind: "letter" }> => t.kind === "letter"
        );
        if (!letterTokens.length) return;
        let target: { ch: string; index: number } | null = null;
        for (let step = 0; step < letterTokens.length; step++) {
          const i =
            ((selectedIndex - step) % letterTokens.length +
              letterTokens.length) %
            letterTokens.length;
          const candidate = letterTokens[i];
          if (guess[candidate.ch] && !hintedEncs.has(candidate.ch)) {
            target = { ch: candidate.ch, index: candidate.index };
            break;
          }
        }
        if (!target) return;
        const targetCh = target.ch;
        setGuess((prev) => {
          const next = { ...prev };
          delete next[targetCh];
          return next;
        });
        setSelectedEnc(target.ch);
        setSelectedIndex(target.index);
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
      // Hinted slots can't be overwritten — skip past so typing keeps flowing.
      if (hintedEncs.has(selectedEnc)) {
        advanceSelection(1);
        return;
      }
      setGuess((prev) => {
        // Assigning a letter that's already used elsewhere clears the old slot,
        // except hinted slots — they're immovable, even on letter collision.
        const next: Record<string, string> = {};
        for (const [enc, val] of Object.entries(prev)) {
          if (val !== k || hintedEncs.has(enc)) next[enc] = val;
        }
        next[selectedEnc] = k;
        return next;
      });
      advanceSelection(1, selectedEnc);
    },
    [puzzle, selectedEnc, selectedIndex, guess, tokens, hintedEncs, advanceSelection]
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

  const flashHintNote = useCallback((msg: string) => {
    setHintNote(msg);
    if (hintNoteTimerRef.current !== null) {
      window.clearTimeout(hintNoteTimerRef.current);
    }
    hintNoteTimerRef.current = window.setTimeout(() => {
      setHintNote(null);
      hintNoteTimerRef.current = null;
    }, 2500);
  }, []);

  // Clean up the hint-note timer on unmount.
  useEffect(
    () => () => {
      if (hintNoteTimerRef.current !== null) {
        window.clearTimeout(hintNoteTimerRef.current);
        hintNoteTimerRef.current = null;
      }
    },
    []
  );

  // Reveal the correct letter for the selected tile (and every tile sharing
  // its encrypted letter). If the user has already guessed it correctly,
  // surface that and don't burn a hint. With no selection, fall back to
  // revealing a random unsolved letter.
  const handleHint = useCallback(() => {
    if (!puzzle) return;
    const revealEnc = (enc: string) => {
      const correct = puzzle.cipher[enc];
      setStartedAt((prev) => prev ?? Date.now());
      setGuess((prev) => {
        const next: Record<string, string> = {};
        for (const [e, val] of Object.entries(prev)) {
          // Same dedup rule as typing: hinted slots are immovable.
          if (val !== correct || hintedEncs.has(e)) next[e] = val;
        }
        next[enc] = correct;
        return next;
      });
      setHints((h) => h + 1);
      setHintedEncs((prev) => {
        const next = new Set(prev);
        next.add(enc);
        return next;
      });
    };
    if (selectedEnc !== null) {
      if (guess[selectedEnc] === puzzle.cipher[selectedEnc]) {
        flashHintNote("That letter is already correct.");
        return;
      }
      revealEnc(selectedEnc);
      return;
    }
    const unsolved: string[] = [];
    for (const enc of encLettersInPuzzle) {
      if (guess[enc] !== puzzle.cipher[enc]) unsolved.push(enc);
    }
    if (!unsolved.length) return;
    revealEnc(unsolved[Math.floor(Math.random() * unsolved.length)]);
  }, [puzzle, selectedEnc, guess, encLettersInPuzzle, hintedEncs, flashHintNote]);

  const handleClear = useCallback(() => {
    if (!confirm("Clear all your guesses?")) return;
    // Hinted letters were paid for and stay locked — preserve them across
    // a clear. Hint counter is also preserved (we never call setHints here).
    setGuess((prev) => {
      const next: Record<string, string> = {};
      for (const [enc, val] of Object.entries(prev)) {
        if (hintedEncs.has(enc)) next[enc] = val;
      }
      return next;
    });
    setSelectedEnc(null);
    setSelectedIndex(null);
    setStartedAt(null);
    setDurationMs(null);
  }, [hintedEncs]);

  // Jump to a random puzzle through the /random route. Picks any number in
  // the corpus except (a) the next year of upcoming dailies — no spoilers —
  // (b) today's daily, and (c) whatever puzzle the user is already looking at.
  // The pick is stored as the "current random"; previous random progress is
  // wiped so the new puzzle starts fresh, while archive progress is untouched.
  const handleRandom = useCallback(() => {
    const exclude = new Set<number>();
    exclude.add(puzzleNumberForDate()); // never re-skin today's daily
    if (isArchive && puzzleNumber !== undefined) exclude.add(puzzleNumber);
    if (isRandom) {
      const current = loadCurrentRandom();
      if (current !== null) exclude.add(current);
    }
    const pick = pickRandomPuzzleNumber(exclude);
    if (pick === null) return;
    clearProgress(RANDOM_DATE_KEY);
    saveCurrentRandom(pick);
    if (window.location.pathname === "/random") {
      window.location.reload();
    } else {
      window.location.href = "/random";
    }
  }, [isArchive, isRandom, puzzleNumber]);

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
            : isRandom
              ? `Random puzzle #${puzzle.number}`
              : `Today's quote — ${puzzle.dateKey} · #${puzzle.number}`}
        </p>
        {!isArchive && !isRandom && (
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
        {(isArchive || isRandom) && (
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
          {hintNote ?? `${hints} ${hints === 1 ? "hint" : "hints"} used`}
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
        <button
          type="button"
          onClick={handleRandom}
          className="rounded border px-3 py-1.5
                     border-[color:var(--secondary-border)]
                     bg-[color:var(--secondary-bg)]
                     text-[color:var(--ink)]
                     hover:bg-[color:var(--secondary-bg-hover)]"
        >
          Random puzzle
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
          streak={
            isArchive || isRandom
              ? null
              : effectiveCurrent(streak, puzzle.dateKey)
          }
          shareable={!isRandom}
          onNewRandom={isRandom ? handleRandom : undefined}
          onClose={() => setShowWin(false)}
        />
      )}
    </div>
  );
}
