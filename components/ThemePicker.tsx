"use client";

import { useEffect, useState } from "react";
import {
  applyTheme,
  loadCustom,
  loadTheme,
  saveCustom,
  saveTheme,
  THEMES,
  type CustomColors,
  type ThemeKey,
} from "@/lib/theme";

export default function ThemePicker() {
  const [theme, setTheme] = useState<ThemeKey>("light");
  const [custom, setCustom] = useState<CustomColors>({
    bg: "#f7f1e3",
    tile: "#e8d4a8",
  });
  // Avoid hydration mismatch — only render the persisted state after mount.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = loadTheme();
    const savedCustom = loadCustom();
    setTheme(savedTheme);
    setCustom(savedCustom);
    applyTheme(savedTheme, savedCustom);
    setMounted(true);
  }, []);

  const handleThemeChange = (next: ThemeKey) => {
    setTheme(next);
    applyTheme(next, custom);
    saveTheme(next);
  };

  const handleColorChange = (key: keyof CustomColors, value: string) => {
    const next = { ...custom, [key]: value };
    setCustom(next);
    saveCustom(next);
    if (theme === "custom") applyTheme("custom", next);
  };

  return (
    <div className="inline-flex flex-col items-end gap-1.5 text-sm">
      <label className="inline-flex items-center gap-2">
        <span className="text-[color:var(--ink-soft)]">Theme</span>
        <select
          value={mounted ? theme : "light"}
          onChange={(e) => handleThemeChange(e.target.value as ThemeKey)}
          className="rounded border px-2 py-1 text-sm
                     bg-[color:var(--secondary-bg)]
                     text-[color:var(--ink)]
                     border-[color:var(--secondary-border)]
                     hover:bg-[color:var(--secondary-bg-hover)]"
        >
          {THEMES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {mounted && theme === "custom" && (
        <div className="flex items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[color:var(--ink-soft)]">Background</span>
            <input
              type="color"
              value={custom.bg}
              onChange={(e) => handleColorChange("bg", e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0
                         border-[color:var(--ink-soft)]"
              aria-label="Background color"
            />
          </label>
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[color:var(--ink-soft)]">Tiles</span>
            <input
              type="color"
              value={custom.tile}
              onChange={(e) => handleColorChange("tile", e.target.value)}
              className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
              aria-label="Tile color"
            />
          </label>
        </div>
      )}
    </div>
  );
}
