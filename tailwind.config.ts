import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#071426",
          secondary: "#0A182A",
          card: "#0C1B2D",
          item: "#091728",
        },
        border: {
          DEFAULT: "#213247",
          soft: "rgba(148, 163, 184, 0.18)",
        },
        emerald: {
          DEFAULT: "#34D399",
          dark: "#065F46",
          soft: "rgba(52, 211, 153, 0.10)",
        },
        text: {
          primary: "#F8FAFC",
          secondary: "#A8B5C7",
          muted: "#718096",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
