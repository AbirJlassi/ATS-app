import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from "@/services/authService";
import { useAuthStore } from "@/store/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((s) => s.setAuth);
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      const token = await authService.login({ email, password });
      localStorage.setItem("access_token", token.access_token);
      const user = await authService.getMe();
      setAuth(user, token.access_token);
      const redirects: Record<string, string> = {
        CANDIDAT: "/candidate/dashboard", RECRUTEUR: "/recruiter/dashboard", ADMINISTRATEUR: "/admin/dashboard",
      };
      navigate(redirects[token.role] ?? "/");
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Identifiants incorrects.");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-canvas flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[45%] bg-ink flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle geometric decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/[0.02] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-sky/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="flex items-center gap-2.5 relative">
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
          <span className="font-display text-xl text-white tracking-tight">
            Fair<span className="text-brand-amaranth">Hire</span>
          </span>
        </div>

        <div className="relative">
          <p className="font-display text-4xl text-white leading-[1.2] mb-6">
            Recrutez<br/>
            <em className="not-italic text-accent">sans biais.</em><br/>
            Décidez avec précision.
          </p>
          <p className="text-white/40 text-sm leading-relaxed max-w-xs">
            FairHire utilise l’intelligence artificielle pour révéler les meilleurs talents et les aligner avec les bonnes opportunités.
          </p>
        </div>

        <div className="flex gap-6 text-white/25 text-xs relative">
          <span>+1 200 candidatures</span>
          <span>340 offres actives</span>
          <span>98 % satisfaction</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="mb-8">
            <h1 className="font-display text-3xl text-ink mb-1">Bon retour.</h1>
            <p className="text-ink-secondary text-sm">Connectez-vous à votre espace FairHire.</p>
          </div>

          {error && (
            <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" className="input-lg" placeholder="vous@exemple.com"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Mot de passe</label>
              <input type="password" className="input-lg" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-2">
              {loading ? "Connexion..." : "Se connecter →"}
            </button>
          </form>

          <p className="text-center text-sm text-ink-muted mt-6">
            Pas de compte ?{" "}
            <Link to="/register" className="text-ink font-medium hover:text-accent-hover transition-colors">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}