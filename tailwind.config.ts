import type { Config } from "tailwindcss";
import forms from "@tailwindcss/forms";

export default {
  content: ["./app/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f8fafc",
          100: "#f1f5f9",
          900: "#0f172a",
        },
        sand: {
          50: "#fdfaf4",
          100: "#f7f0df",
          200: "#ead8b0",
        },
        ember: {
          500: "#c2410c",
          700: "#9a3412",
        },
      },
      fontFamily: {
        sans: ["'IBM Plex Sans'", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [forms],
} satisfies Config;

