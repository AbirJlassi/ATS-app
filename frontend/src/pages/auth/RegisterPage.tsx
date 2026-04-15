/**
 * RegisterPage.tsx — Page d'inscription
 * Layout centré avec fond dégradé subtil, sélecteur de rôle animé,
 * formulaire en étapes visuelles et confirmation animée.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, User, Phone, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import authService from "@/services/authService";
import type { Role } from "@/types";

/* ── Input avec icône ── */
function Field({
  id, label, type = "text", placeholder, value, onChange, icon, required, minLength,
}: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  icon: React.ReactNode; required?: boolean; minLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <div className={`relative flex items-center rounded-xl border transition-all duration-200 bg-white shadow-sm ${focused ? "border-blue-400 ring-4 ring-blue-500/10" : "border-surface-200"
        }`}>
        <div className={`pl-3.5 transition-colors duration-200 ${focused ? "text-blue-500" : "text-ink-muted"}`}>
          {icon}
        </div>
        <input
          id={id} type={type} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          required={required} minLength={minLength}
          className="w-full bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
      </div>
    </div>
  );
}

/* ── Page principale ── */
export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "", password: "", confirm: "", role: "CANDIDAT" as Role,
    nom: "", prenom: "", telephone: "", departement: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deptAutre, setDeptAutre] = useState(false);

  const upd = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      await authService.register({ ...form, role: form.role as "CANDIDAT" | "RECRUTEUR" });
      setSuccess(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erreur lors de l'inscription.");
    } finally { setLoading(false); }
  };

  /* ── Écran de succès ── */
  if (success) return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-3xl shadow-glass border border-surface-200 max-w-sm w-full p-10 text-center"
      >
        <div className="w-16 h-16 rounded-2xl bg-green-50 border border-green-200 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-ink mb-2">Compte créé !</h2>
        <p className="text-ink-secondary text-sm leading-relaxed mb-8">
          Votre compte est en attente de validation par un administrateur.<br />Vous serez notifié dès son activation.
        </p>
        <button
          onClick={() => navigate("/login")}
          className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-secondary transition-all shadow-md"
        >
          Aller à la connexion <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-50 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Logo + Titre */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-9 h-9 rounded-xl bg-brand-primary flex items-center justify-center shadow-sm">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
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
            </div>
            <span className="font-bold text-xl text-brand-primary">Fair<span className="text-blue-500">Hire</span></span>
          </Link>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Créer un compte</h1>
          <p className="text-ink-secondary text-sm mt-1">Rejoignez la plateforme FairHire.</p>
        </div>

        {/* Erreur */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5"
            >
              <span className="text-red-500 mt-0.5">⚠</span> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-white rounded-3xl shadow-glass border border-surface-200 p-7">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Sélecteur de rôle */}
            <div>
              <label className="block text-sm font-medium text-ink mb-2">Je suis</label>
              <div className="grid grid-cols-2 gap-2.5">
                {(["CANDIDAT", "RECRUTEUR"] as const).map((r) => (
                  <button
                    key={r} type="button" onClick={() => upd("role", r)}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all duration-200 ${form.role === r
                      ? "bg-brand-primary text-white border-brand-primary shadow-md"
                      : "bg-white text-ink-secondary border-surface-200 hover:border-brand-accent"
                      }`}
                  >
                    {r === "CANDIDAT" ? "👤 Candidat" : "🏢 Recruteur"}
                  </button>
                ))}
              </div>
            </div>

            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <Field id="reg-prenom" label="Prénom" placeholder="Jean"
                value={form.prenom} onChange={(v) => upd("prenom", v)}
                icon={<User className="w-4 h-4" />} />
              <Field id="reg-nom" label="Nom" placeholder="Dupont"
                value={form.nom} onChange={(v) => upd("nom", v)}
                icon={<User className="w-4 h-4" />} />
            </div>

            <Field id="reg-email" label="Email" type="email" placeholder="vous@exemple.com"
              value={form.email} onChange={(v) => upd("email", v)}
              icon={<Mail className="w-4 h-4" />} required />

            <Field id="reg-password" label="Mot de passe" type="password" placeholder="8 caractères minimum"
              value={form.password} onChange={(v) => upd("password", v)}
              icon={<Lock className="w-4 h-4" />} required minLength={8} />

            <Field id="reg-confirm" label="Confirmer le mot de passe" type="password" placeholder="••••••••"
              value={form.confirm} onChange={(v) => upd("confirm", v)}
              icon={<Lock className="w-4 h-4" />} required />

            <Field id="reg-phone" label="Téléphone (optionnel)" type="tel" placeholder="+216 XX XXX XXX"
              value={form.telephone} onChange={(v) => upd("telephone", v)}
              icon={<Phone className="w-4 h-4" />} />

            {/* Département (Recruteur uniquement) */}
            <AnimatePresence>
              {form.role === "RECRUTEUR" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {/* Select département */}
                  <div>
                    <label htmlFor="reg-dept" className="block text-sm font-medium text-ink mb-1.5">
                      Département
                    </label>
                    <div className="relative flex items-center rounded-xl border border-surface-200 bg-white shadow-sm transition-all duration-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10">
                      <div className="pl-3.5 text-ink-muted">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <select
                        id="reg-dept"
                        value={deptAutre ? "__autre__" : form.departement}
                        onChange={(e) => {
                          if (e.target.value === "__autre__") {
                            setDeptAutre(true);
                            upd("departement", "");
                          } else {
                            setDeptAutre(false);
                            upd("departement", e.target.value);
                          }
                        }}
                        className="w-full bg-transparent px-3 py-2.5 text-sm text-ink focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="">Sélectionner un département</option>
                        <option value="Ingénierie / Technique">Ingénierie / Technique</option>
                        <option value="Data / IA">Data / IA</option>
                        <option value="Produit / Gestion de projet">Produit / Gestion de projet</option>
                        <option value="Ventes / Développement commercial">Ventes / Développement commercial</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Ressources humaines">Ressources humaines</option>
                        <option value="Finance">Finance</option>
                        <option value="Opérations / Support">Opérations / Support</option>
                        <option value="__autre__">Autre…</option>
                      </select>
                      <div className="pr-3.5 pointer-events-none text-ink-muted">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Champ texte libre si "Autre" sélectionné */}
                  <AnimatePresence>
                    {deptAutre && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                      >
                        <Field
                          id="reg-dept-autre"
                          label="Préciser le département"
                          placeholder="ex: Legal, Communication…"
                          value={form.departement}
                          onChange={(v) => upd("departement", v)}
                          icon={<Building2 className="w-4 h-4" />}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-semibold text-sm py-3 rounded-xl hover:bg-brand-secondary transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Création…</>
              ) : (
                <>Créer mon compte <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-secondary mt-5">
          Déjà un compte ?{" "}
          <Link to="/login" className="font-semibold text-brand-accent hover:text-brand-hover transition-colors">
            Se connecter →
          </Link>
        </p>
      </motion.div>
    </div>
  );
}