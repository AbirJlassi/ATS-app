/**
 * Navbar.tsx — Barre de navigation principale
 * Sticky avec effet glassmorphism, logo, badge de rôle et menu utilisateur.
 * Animations subtiles via Framer Motion sur le scroll et les états.
 */
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, User, LayoutDashboard, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/authStore";
import authService from "@/services/authService";

/* ── Labels & couleurs par rôle ─────────────────────────────────── */
const ROLE_META: Record<string, { label: string; color: string; dot: string }> = {
  CANDIDAT:       { label: "Candidat",       color: "text-blue-600 bg-blue-50 border-blue-200",          dot: "bg-blue-500"   },
  RECRUTEUR:      { label: "Recruteur",       color: "text-violet-600 bg-violet-50 border-violet-200",    dot: "bg-violet-500" },
  ADMINISTRATEUR: { label: "Administrateur",  color: "text-amber-600 bg-amber-50 border-amber-200",       dot: "bg-amber-500"  },
};

/* ── Logo SVG — Balance de la Justice ───────────────────────────── */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <line x1="10" y1="3" x2="10" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3"  y1="7" x2="17" y2="7"  stroke="#60A5FA" strokeWidth="2"   strokeLinecap="round"/>
      <line x1="3"  y1="7" x2="3"  y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="17" y1="7" x2="17" y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="3"  cy="12" r="2" fill="#FCD34D"/>
      <path d="M0.5 17 Q3 14.5 5.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="17" cy="12" r="2" fill="#FCD34D"/>
      <path d="M14.5 17 Q17 14.5 19.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round"/>
      <line x1="7" y1="16" x2="13" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  );
}

/* ── Dropdown Menu Utilisateur ───────────────────────────────────── */
function UserMenu({
  user, role, dashboardLink, onLogout,
}: {
  user: NonNullable<ReturnType<typeof useAuthStore>["user"]>;
  role: string;
  dashboardLink: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const meta = ROLE_META[role] ?? { label: role, color: "text-slate-500 bg-slate-50 border-slate-200", dot: "bg-slate-400" };

  // Fermer quand on clique à l'extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const initials = (
    user.prenom?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"
  );
  const displayName = user.prenom ? `${user.prenom} ${user.nom ?? ""}`.trim() : user.email?.split("@")[0];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-surface-100 transition-all duration-200 group"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Avatar */}
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
          {initials}
        </div>
        {/* Nom — masqué sur petit écran */}
        <span className="hidden sm:block text-sm font-medium text-ink group-hover:text-brand-primary transition-colors max-w-[120px] truncate">
          {displayName}
        </span>
        {/* Chevron animé */}
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />
        </motion.div>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-56 bg-white/90 backdrop-blur-md rounded-2xl shadow-glass border border-surface-200 overflow-hidden z-50"
          >
            {/* En-tête */}
            <div className="px-4 py-3 border-b border-surface-100">
              <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
              <p className="text-xs text-ink-muted truncate mt-0.5">{user.email}</p>
              {/* Badge rôle */}
              <span className={`inline-flex items-center gap-1.5 mt-2 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
            </div>

            {/* Actions */}
            <div className="p-1.5">
              <Link
                to={dashboardLink}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-secondary hover:text-ink hover:bg-surface-100 transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Mon espace
              </Link>
              <Link
                to="/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-ink-secondary hover:text-ink hover:bg-surface-100 transition-colors"
              >
                <User className="w-4 h-4" />
                Mon profil
              </Link>
            </div>

            <div className="border-t border-surface-100 p-1.5">
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-danger hover:bg-danger-subtle transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Composant principal ─────────────────────────────────────────── */
export default function Navbar() {
  const { isLoggedIn, user, role, clearAuth } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [scrolled, setScrolled] = useState(false);

  const dashboardLink =
    role === "CANDIDAT"       ? "/candidate/dashboard"  :
    role === "RECRUTEUR"      ? "/recruiter/dashboard"  :
    role === "ADMINISTRATEUR" ? "/admin/dashboard"       : "/";

  const handleLogout = () => {
    authService.logout();
    clearAuth();
    navigate("/login");
  };

  // Ombre et flou au scroll
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // Masquer la navbar sur les pages d'auth
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";
  if (isAuthPage) return null;

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-xl shadow-glass border-b border-surface-200/80"
          : "bg-white/60 backdrop-blur-md border-b border-surface-200/50"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* ── Logo ── */}
        <Link
          to={isLoggedIn ? dashboardLink : "/"}
          className="flex items-center gap-2.5 group"
          aria-label="Retour à l'accueil"
        >
          <div className="w-8 h-8 rounded-xl bg-brand-primary flex items-center justify-center group-hover:bg-brand-secondary transition-colors shadow-sm">
            <Logo />
          </div>
          <span className="font-bold text-[17px] text-brand-primary tracking-tight">
            Fair<span className="text-blue-500">Hire</span>
          </span>
        </Link>

        {/* ── Right section ── */}
        <div className="flex items-center gap-2">
          {isLoggedIn && user ? (
            <UserMenu
              user={user}
              role={role ?? ""}
              dashboardLink={dashboardLink}
              onLogout={handleLogout}
            />
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-ink-secondary hover:text-ink px-3 py-2 rounded-xl hover:bg-surface-100 transition-colors">
                Connexion
              </Link>
              <Link to="/register" className="btn-accent btn-sm text-sm font-semibold px-4 py-2 rounded-xl">
                S'inscrire
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
