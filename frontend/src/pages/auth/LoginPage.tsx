/**
 * LoginPage.tsx — Page de connexion
 * Layout split-screen premium : panneau gauche branding animé,
 * panneau droit formulaire épuré avec micro-animations Framer Motion.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, ArrowRight, CheckCircle2, Users, Zap, Shield } from "lucide-react";
import authService from "@/services/authService";
import { useAuthStore } from "@/store/authStore";

/* ── Carte statistique sur le panneau gauche ─────────────────────── */
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-sm text-white/50 mt-0.5">{label}</span>
    </div>
  );
}

/* ── Feature item ─────────────────────────────────────────────────── */
function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <span className="text-sm text-white/70">{text}</span>
    </div>
  );
}

/* ── Input Field ─────────────────────────────────────────────────── */
function InputField({
  id, label, type, placeholder, value, onChange, icon, required,
}: {
  id: string; label: string; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; icon: React.ReactNode; required?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-2">
        {label}
      </label>
      <div className={`relative flex items-center transition-all duration-200 rounded-xl border ${
        focused ? "border-blue-400 ring-4 ring-blue-500/10" : "border-surface-200"
      } bg-white shadow-sm`}>
        <div className={`pl-4 transition-colors duration-200 ${focused ? "text-blue-500" : "text-ink-muted"}`}>
          {icon}
        </div>
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          required={required}
          className="w-full bg-transparent px-3 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
      </div>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate  = useNavigate();
  const setAuth   = useAuthStore((s) => s.setAuth);
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const token = await authService.login({ email, password });
      localStorage.setItem("access_token", token.access_token);
      const user = await authService.getMe();
      setAuth(user, token.access_token);
      const redirects: Record<string, string> = {
        CANDIDAT:       "/candidate/dashboard",
        RECRUTEUR:      "/recruiter/dashboard",
        ADMINISTRATEUR: "/admin/dashboard",
      };
      navigate(redirects[token.role] ?? "/");
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail ?? "Identifiants incorrects.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface-50">

      {/* ── Panneau gauche — Branding ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="hidden lg:flex lg:w-[45%] xl:w-[42%] relative flex-col justify-between overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0F172A 0%, #1E3A5F 60%, #1E40AF 100%)" }}
      >
        {/* Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/[0.03]" />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 rounded-full bg-blue-400/[0.07]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full border border-white/[0.04]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-white/[0.02]" />
        </div>

        {/* Logo */}
        <div className="relative p-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <line x1="10" y1="3" x2="10" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round"/>
              <line x1="3" y1="7" x2="17" y2="7" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="7" x2="3" y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="17" y1="7" x2="17" y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="3" cy="12" r="2" fill="#FCD34D"/>
              <path d="M0.5 17 Q3 14.5 5.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="17" cy="12" r="2" fill="#FCD34D"/>
              <path d="M14.5 17 Q17 14.5 19.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="7" y1="16" x2="13" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <span className="font-bold text-xl text-white tracking-tight">
            Fair<span className="text-blue-400">Hire</span>
          </span>
        </div>

        {/* Tagline principale */}
        <div className="relative px-10 flex-1 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          >
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-[1.1] mb-5">
              Recrutez<br />
              <span className="text-blue-400">sans biais.</span><br />
              Décidez avec<br/>précision.
            </h2>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-10">
              FairHire utilise l'intelligence artificielle pour révéler les meilleurs talents et les aligner avec les bonnes opportunités.
            </p>
            <div className="space-y-3">
              <Feature icon={<Zap className="w-4 h-4 text-blue-400" />} text="Analyse automatique des CV par IA" />
              <Feature icon={<Shield className="w-4 h-4 text-blue-400" />} text="Recrutement équitable et transparent" />
              <Feature icon={<Users className="w-4 h-4 text-blue-400" />} text="Gestion centralisée des candidatures" />
            </div>
          </motion.div>
        </div>

        {/* Stats */}
        <div className="relative p-10 border-t border-white/10">
          <div className="flex gap-8">
            <StatCard value="+1 200" label="candidatures" />
            <StatCard value="340"   label="offres actives" />
            <StatCard value="98 %"  label="satisfaction" />
          </div>
        </div>
      </motion.div>

      {/* ── Panneau droit — Formulaire ───────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-sm"
        >
          {/* Titre */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-ink tracking-tight mb-2">
              Bon retour. 👋
            </h1>
            <p className="text-ink-secondary text-sm">
              Connectez-vous à votre espace FairHire.
            </p>
          </div>

          {/* Alerte erreur */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6"
              >
                <span className="text-red-500 mt-0.5">⚠</span>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <InputField
              id="login-email"
              label="Adresse email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={setEmail}
              icon={<Mail className="w-4 h-4" />}
              required
            />
            <InputField
              id="login-password"
              label="Mot de passe"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={setPassword}
              icon={<Lock className="w-4 h-4" />}
              required
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-secondary transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Connexion…
                </>
              ) : (
                <>
                  Se connecter
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-surface-200" />
            <span className="text-xs text-ink-muted">ou</span>
            <div className="flex-1 h-px bg-surface-200" />
          </div>

          {/* Lien inscription */}
          <div className="text-center">
            <p className="text-sm text-ink-secondary">
              Pas encore de compte ?{" "}
              <Link
                to="/register"
                className="font-semibold text-brand-accent hover:text-brand-hover transition-colors"
              >
                Créer un compte →
              </Link>
            </p>
          </div>

          {/* Badge sécurité */}
          <div className="mt-8 flex items-center justify-center gap-2 text-ink-muted">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-xs">Connexion sécurisée — données chiffrées</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
