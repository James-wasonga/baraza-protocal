/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep, night-council palette — not a generic dark-mode SaaS gray.
        ink: {
          950: "#0E1A15",
          900: "#12211C",
          800: "#1B2E27",
          700: "#223A31",
          600: "#2E4C40",
          border: "#324A3F",
        },
        bone: {
          100: "#F3EFE3",
          300: "#D8D2C0",
          500: "#9FB0A8",
        },
        marigold: {
          400: "#EDB55D",
          500: "#E3A23C",
          600: "#C7862A",
        },
        dusk: {
          400: "#6E8FB0",
          500: "#4C6B8A",
          600: "#3A5470",
        },
        sage: {
          500: "#7C9473",
        },
        rust: {
          500: "#C15B3E",
        },
      },
      fontFamily: {
        display: ["\"Fraunces\"", "ui-serif", "Georgia", "serif"],
        sans: ["\"IBM Plex Sans\"", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["\"IBM Plex Mono\"", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(243, 239, 227, 0.06)",
      },
    },
  },
  plugins: [],
};
