import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Georgia"', '"Times New Roman"', "serif"],
      },
      // All colors are driven by CSS variables defined per-theme in globals.css.
      // Components reference them via arbitrary-value utilities like
      // `bg-[color:var(--bg)]` so the theme can swap without a rebuild.
    },
  },
  plugins: [],
};

export default config;
