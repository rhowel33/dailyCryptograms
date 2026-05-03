// One-time script: deterministically shuffle the entries in lib/quotes.ts.
// After running, quotes[0] is day 1's puzzle, quotes[1] is day 2, etc.
// Run with: node scripts/shuffle-quotes.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUOTES_PATH = join(__dirname, "..", "lib", "quotes.ts");
const SEED = "daily-cryptograms-schedule:v1";

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

const src = readFileSync(QUOTES_PATH, "utf8");
const lines = src.split("\n");

const startIdx = lines.findIndex((l) => l.startsWith("export const quotes"));
if (startIdx === -1) throw new Error("could not find quotes array start");

const endIdx = lines.findIndex((l, i) => i > startIdx && l.trim() === "];");
if (endIdx === -1) throw new Error("could not find quotes array end");

const before = lines.slice(0, startIdx + 1);
const entries = lines.slice(startIdx + 1, endIdx);
const after = lines.slice(endIdx);

// Sanity: every entry should be a `{ text: ..., author: ... }` line.
for (const line of entries) {
  if (!line.trimStart().startsWith("{ text:")) {
    throw new Error(`unexpected line in quotes array: ${line}`);
  }
}

const rng = rngFromString(SEED);
const shuffled = shuffle(entries, rng);

const out = [...before, ...shuffled, ...after].join("\n");
writeFileSync(QUOTES_PATH, out);
console.log(`Shuffled ${entries.length} quotes with seed "${SEED}".`);
