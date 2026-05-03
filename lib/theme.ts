export type ThemeKey = "light" | "dark" | "sepia" | "custom";

export const THEMES: { key: ThemeKey; label: string }[] = [
  { key: "light", label: "Light" },
  { key: "dark", label: "Dark" },
  { key: "sepia", label: "Sepia" },
  { key: "custom", label: "Custom" },
];

export const THEME_STORAGE_KEY = "dc-theme";
export const CUSTOM_STORAGE_KEY = "dc-theme-custom";

export type CustomColors = { bg: string; tile: string };
export const DEFAULT_CUSTOM: CustomColors = { bg: "#f7f1e3", tile: "#e8d4a8" };

const PRESET_CLASSES = ["theme-dark", "theme-sepia"];
// CSS vars overridden by a custom theme; cleared when switching back to a preset.
const CUSTOM_OVERRIDE_VARS = [
  "--bg",
  "--ink",
  "--tile-face",
  "--tile-edge",
  "--tile-shadow",
  "--tile-border",
  "--tile-border-active",
  "--tile-text",
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  const to = (n: number) => {
    const v = Math.round(Math.max(0, Math.min(255, n)));
    return v.toString(16).padStart(2, "0");
  };
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r * factor, g * factor, b * factor]);
}

// Perceived brightness — used to decide whether to layer custom on the dark
// or light base, and to pick legible text colors automatically.
function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function clearCustom(root: HTMLElement) {
  for (const v of CUSTOM_OVERRIDE_VARS) root.style.removeProperty(v);
}

function applyCustom(root: HTMLElement, c: CustomColors) {
  const dark = luminance(c.bg) < 0.5;
  // Pick the matching preset as a base so keyboard/modal/etc. stay legible.
  if (dark) root.classList.add("theme-dark");

  const ink = luminance(c.bg) < 0.5 ? "#f1f5f9" : "#1f2937";
  const tileText = luminance(c.tile) < 0.5 ? "#f8fafc" : "#0f172a";

  root.style.setProperty("--bg", c.bg);
  root.style.setProperty("--ink", ink);
  root.style.setProperty("--tile-face", c.tile);
  root.style.setProperty("--tile-edge", darken(c.tile, 0.85));
  root.style.setProperty("--tile-shadow", darken(c.tile, 0.6));
  root.style.setProperty("--tile-border", darken(c.tile, 0.78));
  root.style.setProperty("--tile-border-active", darken(c.tile, 0.55));
  root.style.setProperty("--tile-text", tileText);
}

export function applyTheme(theme: ThemeKey, custom?: CustomColors): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const cls of PRESET_CLASSES) root.classList.remove(cls);
  clearCustom(root);

  if (theme === "dark") root.classList.add("theme-dark");
  else if (theme === "sepia") root.classList.add("theme-sepia");
  else if (theme === "custom") applyCustom(root, custom ?? DEFAULT_CUSTOM);
  // light: no class, no overrides — :root defaults take effect
}

export function loadTheme(): ThemeKey {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "dark" || v === "sepia" || v === "custom" || v === "light") return v;
  } catch {
    // ignore
  }
  return "light";
}

export function saveTheme(theme: ThemeKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadCustom(): CustomColors {
  if (typeof window === "undefined") return DEFAULT_CUSTOM;
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM;
    const parsed = JSON.parse(raw) as Partial<CustomColors>;
    return {
      bg: typeof parsed.bg === "string" ? parsed.bg : DEFAULT_CUSTOM.bg,
      tile: typeof parsed.tile === "string" ? parsed.tile : DEFAULT_CUSTOM.tile,
    };
  } catch {
    return DEFAULT_CUSTOM;
  }
}

export function saveCustom(c: CustomColors): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(c));
  } catch {
    // ignore
  }
}
