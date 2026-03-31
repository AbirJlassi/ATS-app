import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import authService from "@/services/authService";

const ROLE_LABELS: Record<string, string> = {
  CANDIDAT: "Candidat", RECRUTEUR: "Recruteur", ADMINISTRATEUR: "Admin",
};
const ROLE_COLORS: Record<string, string> = {
  CANDIDAT: "badge-accent", RECRUTEUR: "badge-neutral", ADMINISTRATEUR: "badge-warning",
};

export default function Navbar() {
  const { isLoggedIn, user, role, clearAuth } = useAuthStore();
  const navigate = useNavigate();

  const dashboardLink =
    role === "CANDIDAT" ? "/candidate/dashboard" :
    role === "RECRUTEUR" ? "/recruiter/dashboard" :
    role === "ADMINISTRATEUR" ? "/admin/dashboard" : "/";

  const handleLogout = () => { authService.logout(); clearAuth(); navigate("/login"); };

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-border">
      <nav className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link to={isLoggedIn ? dashboardLink : "/"} className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-ink flex items-center justify-center
                group-hover:bg-ink/85 transition-colors">
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
    {/* Axe central */}
    <line x1="10" y1="3" x2="10" y2="16" stroke="#80D6EC" strokeWidth="1.8" strokeLinecap="round"/>
    {/* Fléau horizontal */}
    <line x1="3" y1="7" x2="17" y2="7" stroke="#80D6EC" strokeWidth="2" strokeLinecap="round"/>
    {/* Chaînes */}
    <line x1="3" y1="7" x2="3" y2="10" stroke="#80D6EC" strokeWidth="1.4" strokeLinecap="round"/>
    <line x1="17" y1="7" x2="17" y2="10" stroke="#80D6EC" strokeWidth="1.4" strokeLinecap="round"/>
    {/* Candidat gauche — tête */}
    <circle cx="3" cy="12" r="2" fill="#F1BB2B"/>
    {/* Candidat gauche — épaules */}
    <path d="M0.5 17 Q3 14.5 5.5 17" stroke="#F1BB2B" strokeWidth="1.4" strokeLinecap="round"/>
    {/* Candidat droit — tête */}
    <circle cx="17" cy="12" r="2" fill="#F1BB2B"/>
    {/* Candidat droit — épaules */}
    <path d="M14.5 17 Q17 14.5 19.5 17" stroke="#F1BB2B" strokeWidth="1.4" strokeLinecap="round"/>
    {/* Socle */}
    <line x1="7" y1="16" x2="13" y2="16" stroke="#80D6EC" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
</div>
          <span className="font-display text-lg text-ink tracking-tight">
            Fair<span className="text-brand-amaranth">Hire</span>
          </span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2">
          {isLoggedIn && user ? (
            <>
              <span className={`${ROLE_COLORS[role ?? ""] ?? "badge-neutral"} badge hidden sm:inline-flex`}>
                {ROLE_LABELS[role ?? ""] ?? role}
              </span>

              <Link to="/profile"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl
                           hover:bg-canvas transition-colors group">
                <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center
                                justify-center text-accent-hover font-semibold text-xs">
                  {user.prenom?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="text-sm text-ink-secondary group-hover:text-ink
                                  transition-colors hidden sm:block">
                  {user.prenom ?? user.email?.split("@")[0]}
                </span>
              </Link>

              <button onClick={handleLogout}
                className="btn-ghost btn-sm text-ink-secondary hover:text-danger">
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost btn-sm">Connexion</Link>
              <Link to="/register" className="btn-primary btn-sm">S'inscrire</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
