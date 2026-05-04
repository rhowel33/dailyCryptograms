// One-time script: merge movie quotes from movie_quotes_cryptograms.csv into
// lib/quotes.ts, preserving the first N entries (those that have already gone
// live as a daily) and deterministically reshuffling everything that follows.
// Run with: node scripts/mix-movie-quotes.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const QUOTES_PATH = join(ROOT, "lib", "quotes.ts");
const CSV_PATH = join(ROOT, "movie_quotes_cryptograms.csv");
const SEED = "daily-cryptograms-schedule:v2-with-movies";

// Number of leading quotes that have already been served as a daily and must
// stay pinned at the same array index. Today is 2026-05-04 (puzzle #2), so
// puzzles #1 and #2 are live.
const PRESERVED_COUNT = 2;

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFromString(seed) {
  return mulberry32(xmur3(seed)());
}
function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Parse a CSV row supporting RFC4180-style quoted fields with "" escapes.
function parseCsvRow(row) {
  const fields = [];
  let i = 0;
  while (i < row.length) {
    if (row[i] === '"') {
      let end = i + 1;
      let buf = "";
      while (end < row.length) {
        if (row[end] === '"') {
          if (row[end + 1] === '"') {
            buf += '"';
            end += 2;
            continue;
          }
          break;
        }
        buf += row[end];
        end++;
      }
      fields.push(buf);
      i = end + 1;
      if (row[i] === ",") i++;
    } else {
      let end = row.indexOf(",", i);
      if (end === -1) end = row.length;
      fields.push(row.slice(i, end));
      i = end + 1;
    }
  }
  return fields;
}

// Serialize a {text, author} entry into the exact one-line shape the rest of
// quotes.ts uses, so the diff is purely additive/reordering.
function entryLine(text, author) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `  { text: "${esc(text)}", author: "${esc(author)}" },`;
}

// Read the CSV and convert to entry lines.
const csvSrc = readFileSync(CSV_PATH, "utf8");
const csvLines = csvSrc.trim().split("\n").slice(1); // skip header
const movieEntries = csvLines.map((line) => {
  const [quote, movie] = parseCsvRow(line);
  return entryLine(quote, movie);
});
console.log(`movie quotes parsed: ${movieEntries.length}`);

// Read existing quotes.ts and slice out the array body.
const tsSrc = readFileSync(QUOTES_PATH, "utf8");
const tsLines = tsSrc.split("\n");
const startIdx = tsLines.findIndex((l) => l.startsWith("export const quotes"));
if (startIdx === -1) throw new Error("could not find quotes array start");
const endIdx = tsLines.findIndex((l, i) => i > startIdx && l.trim() === "];");
if (endIdx === -1) throw new Error("could not find quotes array end");

const before = tsLines.slice(0, startIdx + 1);
const existingEntries = tsLines.slice(startIdx + 1, endIdx);
const after = tsLines.slice(endIdx);

// Sanity: every existing line should be a `{ text:` entry.
for (const line of existingEntries) {
  if (!line.trimStart().startsWith("{ text:")) {
    throw new Error(`unexpected line in quotes array: ${line}`);
  }
}
console.log(`existing entries: ${existingEntries.length}`);

if (PRESERVED_COUNT > existingEntries.length) {
  throw new Error("PRESERVED_COUNT exceeds existing entry count");
}

const preserved = existingEntries.slice(0, PRESERVED_COUNT);
const remaining = existingEntries.slice(PRESERVED_COUNT);
const pool = [...remaining, ...movieEntries];
const rng = rngFromString(SEED);
const shuffled = shuffle(pool, rng);

const out = [...before, ...preserved, ...shuffled, ...after].join("\n");
writeFileSync(QUOTES_PATH, out);
console.log(
  `wrote ${preserved.length + shuffled.length} entries (${preserved.length} preserved, ${shuffled.length} shuffled). seed="${SEED}"`
);
