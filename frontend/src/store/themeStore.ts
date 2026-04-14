/**
 * themeStore.ts — Gestion du thème dark/light
 *
 * Persiste le choix dans localStorage et synchronise
 * la classe `dark` sur le <html> pour Tailwind dark mode.
 */
import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeState {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (t: Theme) => void;
}

/** Applique/retire la classe `dark` sur <html> */
function applyTheme(theme: Theme) {
    if (theme === "dark") {
        document.documentElement.classList.add("dark");
    } else {
        document.documentElement.classList.remove("dark");
    }
}

/** Lit le thème initial depuis localStorage (défaut : dark) */
const initialTheme: Theme =
    (localStorage.getItem("faihire-theme") as Theme) ?? "dark";

// Applique immédiatement au chargement (avant le premier render)
applyTheme(initialTheme);

export const useThemeStore = create<ThemeState>((set) => ({
    theme: initialTheme,

    setTheme: (theme) => {
        localStorage.setItem("faihire-theme", theme);
        applyTheme(theme);
        set({ theme });
    },

    toggleTheme: () => {
        set((state) => {
            const next: Theme = state.theme === "dark" ? "light" : "dark";
            localStorage.setItem("faihire-theme", next);
            applyTheme(next);
            return { theme: next };
        });
    },
}));