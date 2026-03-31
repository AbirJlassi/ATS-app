import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from "@/services/authService";
import type { Role } from "@/types";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", role: "CANDIDAT" as Role, nom: "", prenom: "", telephone: "", departement: "" });
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const update = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      await authService.register({ ...form, role: form.role as "CANDIDAT" | "RECRUTEUR" });
      setSuccess(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erreur lors de l'inscription.");
    } finally { setLoading(false); }
  };

  if (success) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="card max-w-sm w-full text-center animate-scale-in">
        <div className="w-12 h-12 rounded-2xl bg-success-subtle flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 10L8 14L16 6" stroke="#2DC98A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="font-display text-2xl text-ink mb-2">Compte créé !</h2>
        <p className="text-ink-secondary text-sm mb-6">
          Votre compte est en attente de validation par un administrateur. Vous serez notifié dès son activation.
        </p>
        <button onClick={() => navigate("/login")} className="btn-primary w-full">
          Aller à la connexion →
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-xl bg-ink flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 11L7 3L12 11" stroke="#80D6EC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 8.5H10" stroke="#F1BB2B" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-display text-xl text-ink">Fair<span className="text-brand-amaranth">Hire</span></span>
          </Link>
          <h1 className="font-display text-3xl text-ink mb-1">Créer un compte</h1>
          <p className="text-ink-secondary text-sm">Rejoignez la plateforme FairHire.</p>
        </div>

        {error && <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Rôle */}
            <div>
              <label className="block text-xs font-medium text-ink-muted mb-2 uppercase tracking-wide">Je suis</label>
              <div className="grid grid-cols-2 gap-2">
                {(["CANDIDAT", "RECRUTEUR"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => update("role", r)}
                    className={`py-3 rounded-xl border text-sm font-medium transition-all ${
                      form.role === r
                        ? "bg-ink text-white border-ink"
                        : "bg-surface text-ink-secondary border-border hover:border-ink/30"
                    }`}>
                    {r === "CANDIDAT" ? "Candidat" : "Recruteur"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Prénom</label>
                <input type="text" className="input" placeholder="Jean" value={form.prenom} onChange={(e) => update("prenom", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Nom</label>
                <input type="text" className="input" placeholder="Dupont" value={form.nom} onChange={(e) => update("nom", e.target.value)} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Email <span className="text-danger">*</span></label>
              <input type="email" className="input" placeholder="vous@exemple.com" value={form.email} onChange={(e) => update("email", e.target.value)} required />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Mot de passe <span className="text-danger">*</span></label>
              <input type="password" className="input" placeholder="8 caractères minimum" value={form.password} onChange={(e) => update("password", e.target.value)} required minLength={8} />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Téléphone</label>
              <input type="tel" className="input" placeholder="+216 XX XXX XXX" value={form.telephone} onChange={(e) => update("telephone", e.target.value)} />
            </div>

            {form.role === "RECRUTEUR" && (
              <div>
                <label className="block text-xs font-medium text-ink-muted mb-1.5 uppercase tracking-wide">Département</label>
                <input type="text" className="input" placeholder="ex: Ressources Humaines" value={form.departement} onChange={(e) => update("departement", e.target.value)} />
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary btn-lg w-full mt-2">
              {loading ? "Création..." : "Créer mon compte →"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-ink-muted mt-4">
          Déjà un compte ?{" "}
          <Link to="/login" className="text-ink font-medium hover:text-accent-hover transition-colors">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
