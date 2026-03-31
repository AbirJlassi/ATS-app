/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // FairHire palette (from logo)
        brand: {
          sky:      "#80D6EC",
          amaranth: "#E3445E",
          sun:      "#F1BB2B",
          white:    "#FCFEFD",
        },
        // Design system
        canvas:  "#FAFAF8",       // fond principal — blanc chaud
        surface: "#FFFFFF",       // cartes
        border:  "#EBEBEA",       // bordures légères
        ink: {
          DEFAULT: "#1A1A1A",     // texte principal
          secondary: "#6B6B6B",  // texte secondaire
          muted:    "#A8A8A4",    // texte tertiaire
        },
        accent: {
          DEFAULT: "#80D6EC",
          hover:   "#5EC8E3",
          subtle:  "#EEF9FC",
        },
        danger: {
          DEFAULT: "#E3445E",
          subtle:  "#FDF0F2",
        },
        warning: {
          DEFAULT: "#F1BB2B",
          subtle:  "#FFFBEB",
        },
        success: {
          DEFAULT: "#2DC98A",
          subtle:  "#EDFAF4",
        },
      },
      fontFamily: {
        display: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        "soft":   "0 1px 3px 0 rgba(0,0,0,0.04), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card":   "0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px -2px rgba(0,0,0,0.06)",
        "card-hover": "0 0 0 1px rgba(0,0,0,0.08), 0 8px 24px -4px rgba(0,0,0,0.10)",
        "modal":  "0 0 0 1px rgba(0,0,0,0.08), 0 24px 48px -8px rgba(0,0,0,0.16)",
      },
      animation: {
        "fade-in":    "fadeIn 0.2s ease-out",
        "slide-up":   "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in":   "scaleIn 0.15s ease-out",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" },                      to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.97)" },     to: { opacity: "1", transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
};