import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f4fbf7",
          100: "#d6f3e0",
          200: "#aee5c1",
          300: "#7cd19c",
          400: "#48b974",
          500: "#23985a",
          600: "#177947",
          700: "#135f3a",
          800: "#124c31",
          900: "#103f2a"
        },
        ink: "#101726",
        sand: "#f7f2e9"
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 20px 50px rgba(16, 23, 38, 0.12)"
      },
      backgroundImage: {
        "page-light":
          "radial-gradient(circle at top left, rgba(35,152,90,0.18), transparent 28%), radial-gradient(circle at top right, rgba(180,83,9,0.08), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.95), rgba(247,242,233,0.92))",
        "page-dark":
          "radial-gradient(circle at top left, rgba(72,185,116,0.18), transparent 28%), radial-gradient(circle at top right, rgba(251,191,36,0.10), transparent 22%), linear-gradient(180deg, rgba(16,23,38,1), rgba(15,23,42,0.95))"
      }
    }
  },
  plugins: []
} satisfies Config;
