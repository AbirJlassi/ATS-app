/**
 * Navbar.tsx — Barre de navigation principale
 *
 * Simplifiée après l'ajout de la Sidebar :
 * - Visible uniquement sur les pages d'auth (login, register)
 *   et sur les pages sans sidebar (pages publiques)
 * - Sur les dashboards : la navbar est retirée, la Sidebar gère la nav
 *
 * Sur les pages d'auth : affiche logo + liens connexion/inscription
 */
import { Link, useLocation } from "react-router-dom";
import { useThemeStore } from "@/store/themeStore";
import { Sun, Moon } from "lucide-react";

/* ── Logo SVG ── */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <line x1="10" y1="3" x2="10" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3" y1="7" x2="17" y2="7" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="7" x2="3" y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="17" y1="7" x2="17" y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="3" cy="12" r="2" fill="#FCD34D" />
      <path d="M0.5 17 Q3 14.5 5.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="17" cy="12" r="2" fill="#FCD34D" />
      <path d="M14.5 17 Q17 14.5 19.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="7" y1="16" x2="13" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Composant Navbar ── */
export default function Navbar() {
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();

  // Routes considérées comme "auth" (sans sidebar)
  const authRoutes = ["/login", "/register"];
  const isAuthPage = authRoutes.includes(location.pathname);

  // Routes avec sidebar → pas de navbar
  const hasSidebar = location.pathname.startsWith("/candidate")
    || location.pathname.startsWith("/recruiter")
    || location.pathname.startsWith("/admin")
    || location.pathname.startsWith("/profile");

  if (hasSidebar) return null;

  return (
    <header
      className="sticky top-0 z-40 transition-colors duration-300"
      style={{
        background: "var(--navbar-bg)",
        borderBottom: "1px solid var(--navbar-border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to="/login" className="flex items-center gap-2.5 group" aria-label="FairHire">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Logo />
          </div>
          <span
            className="font-bold text-[17px] tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            Fair<span className="text-blue-500">Hire</span>
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Toggle thème */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
            style={{
              background: "var(--surface-hover)",
              color: "var(--text-secondary)",
            }}
            aria-label={theme === "dark" ? "Mode clair" : "Mode sombre"}
          >
            {theme === "dark"
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />
            }
          </button>

          {isAuthPage && (
            <>
              <Link
                to="/login"
                className="text-sm font-medium px-3 py-2 rounded-xl transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                Connexion
              </Link>
              <Link
                to="/register"
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-blue-600 text-white
                           hover:bg-blue-500 transition-colors shadow-sm"
              >
                S'inscrire
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}