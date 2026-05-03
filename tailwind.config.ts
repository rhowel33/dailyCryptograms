import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Georgia"', '"Times New Roman"', "serif"],
      },
      colors: {
        tile: {
          face: "#e8d4a8",
          edge: "#caa86a",
          shadow: "#a47a3a",
        },
        cryptoBlue: "#2546e0",
      },
    },
  },
  plugins: [],
};

export default config;
