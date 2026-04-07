/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Premium Light Theme Palette
        brand: {
          primary: "#0F172A",   // Very dark slate, almost black for primary accents
          secondary: "#334155", // Slate 700
          accent: "#2563EB",    // Sharp crisp blue for buttons
          hover: "#1D4ED8",     // Darker blue for hover states
          surface: "#F8FAFC",   // Slate 50
        },
        surface: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          glass: 'rgba(255, 255, 255, 0.7)',
        },
        ink: {
          DEFAULT: "#0F172A",   // Slate 900
          secondary: "#475569", // Slate 600
          muted: "#94A3B8",     // Slate 400
        },
        danger: {
          DEFAULT: "#EF4444",
          hover: "#DC2626",
          subtle: "#FEF2F2",
        },
        success: {
          DEFAULT: "#10B981",
          hover: "#059669",
          subtle: "#ECFDF5",
        },
        warning: {
          DEFAULT: "#F59E0B",
          hover: "#D97706",
          subtle: "#FFFBEB",
        }
      },
      fontFamily: {
        display: ['"Inter"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.05)',
        'glass-hover': '0 10px 40px rgba(0, 0, 0, 0.08)',
        'soft': '0 2px 10px rgba(0,0,0,0.02), 0 1px 3px rgba(0,0,0,0.03)',
        'float': '0 20px 40px -10px rgba(0,0,0,0.05)',
      },
      backdropBlur: {
        'xs': '2px',
        'md': '8px',
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out forwards",
        "slide-up": "slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "scale-in": "scaleIn 0.3s ease-out forwards",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
    },
  },
  plugins: [],
};