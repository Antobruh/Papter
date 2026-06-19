import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["Fira Code", "monospace"],
      },
      colors: {
        violet: { DEFAULT: "#7c3aed", light: "#a78bfa" },
        cyan:   { DEFAULT: "#06b6d4", light: "#67e8f9" },
      },
    },
  },
  plugins: [],
} satisfies Config;
