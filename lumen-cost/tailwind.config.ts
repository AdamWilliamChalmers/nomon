import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f4f6f5",
          100: "#e3e8e6",
          200: "#c6d0cc",
          300: "#9aaba4",
          400: "#6b847a",
          500: "#4d665d",
          600: "#3b514a",
          700: "#31423c",
          800: "#2a3733",
          900: "#242e2b",
          950: "#121916",
        },
        citrus: {
          400: "#c8e86a",
          500: "#a8d43a",
          600: "#86ad1f",
        },
        ember: {
          400: "#f0a46a",
          500: "#e07a3a",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
