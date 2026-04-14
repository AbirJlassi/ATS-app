/**
 * tailwind.config.js — Configuration Tailwind FairHire
 *
 * IMPORTANT : darkMode est réglé sur "class" pour que
 * la classe `dark` sur <html> active les variantes dark:.
 */
/** @type {import('tailwindcss').Config} */
export default {
  // Active le dark mode via la classe CSS `.dark` sur <html>
  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      fontFamily: {
        // DM Sans pour le corps (chargé via Google Fonts dans index.html)
        sans: ["DM Sans", "ui-sans-serif", "system-ui", "sans-serif"],
        // Instrument Serif pour les titres
        serif: ["Instrument Serif", "Georgia", "serif"],
      },

      colors: {
        // Brand
        brand: {
          primary: "#1D4ED8",
          secondary: "#1E40AF",
          accent: "#3B82F6",
          hover: "#2563EB",
          surface: "rgba(59,130,246,0.08)",
        },
        // Ink
        ink: {
          DEFAULT: "#0F172A",
          secondary: "#4B5563",
          muted: "#9CA3AF",
        },
        // Surface
        surface: {
          50: "#F4F5F7",
          100: "#EEF0F4",
          200: "#E2E6ED",
          300: "#C9D0DC",
        },
        // Sémantique
        success: {
          DEFAULT: "#10B981",
          hover: "#059669",
          subtle: "rgba(16,185,129,0.1)",
        },
        warning: {
          DEFAULT: "#F59E0B",
          hover: "#D97706",
          subtle: "rgba(245,158,11,0.1)",
        },
        danger: {
          DEFAULT: "#EF4444",
          hover: "#DC2626",
          subtle: "rgba(239,68,68,0.1)",
        },
      },

      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        glass: "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)",
        "glass-hover": "0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        dark: "0 4px 24px rgba(0,0,0,0.4)",
      },

      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
        "4xl": "1.5rem",
      },
    },
  },

  plugins: [],
};