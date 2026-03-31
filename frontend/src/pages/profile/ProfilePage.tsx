import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import authService from "@/services/authService";

const ROLE_LABELS: Record<string, string> = { CANDIDAT: "Candidat", RECRUTEUR: "Recruteur", ADMINISTRATEUR: "Administrateur" };

export default function ProfilePage() {
  const { user, setAuth } = useAuthStore();
  const [form, setForm] = useState({ nom: user?.nom ?? "", prenom: user?.prenom ?? "", telephone: user?.telephone ?? "", departement: user?.departement ?? "", password: "", confirm: "" });
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const upd = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setSuccess(false);
    if (form.password && form.password !== form.confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setLoading(true);
    try {
      const payload: Record<string, string> = { nom: form.nom, prenom: form.prenom, telephone: form.telephone, departement: form.departement };
      if (form.password) payload.password = form.password;
      const updated = await authService.updateMe(payload);
      setAuth(updated, localStorage.getItem("access_token") ?? "");
      setSuccess(true);
      setForm((f) => ({ ...f, password: "", confirm: "" }));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erreur.");
    } finally { setLoading(false); }
  };

  return (
    <div className="page-sm animate-fade-in">
      <div className="mb-8">
        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">Compte</p>
        <h1 className="font-display text-3xl text-ink">Mon profil</h1>
      </div>

      {/* Identity card */}
      <div className="card mb-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-ink flex items-center justify-center text-accent font-display text-2xl">
          {user?.prenom?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <p className="font-semibold text-ink text-lg">
            {user?.prenom && user?.nom ? `${user.prenom} ${user.nom}` : user?.email}
          </p>
          <p className="text-ink-muted text-sm">{user?.email}</p>
          <span className="badge-neutral badge mt-1">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</span>
        </div>
      </div>

      {success && <div className="bg-success-subtle border border-success/20 text-success text-sm rounded-xl px-4 py-3 mb-5">✓ Profil mis à jour avec succès.</div>}
      {error   && <div className="bg-danger-subtle  border border-danger/20  text-danger  text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}

      <form onSubmit={handleSubmit} className="card space-y-5">
        <div>
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-4">Informations personnelles</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-ink-muted mb-1.5">Prénom</label>
              <input type="text" className="input" value={form.prenom} onChange={(e) => upd("prenom", e.target.value)} placeholder="Jean" />
            </div>
            <div>
              <label className="block text-xs text-ink-muted mb-1.5">Nom</label>
              <input type="text" className="input" value={form.nom} onChange={(e) => upd("nom", e.target.value)} placeholder="Dupont" />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1.5">Téléphone</label>
          <input type="tel" className="input" value={form.telephone} onChange={(e) => upd("telephone", e.target.value)} placeholder="+216 XX XXX XXX" />
        </div>
        {user?.role === "RECRUTEUR" && (
          <div>
            <label className="block text-xs text-ink-muted mb-1.5">Département</label>
            <input type="text" className="input" value={form.departement} onChange={(e) => upd("departement", e.target.value)} placeholder="ex: Ressources Humaines" />
          </div>
        )}

        <div className="divider" />
        <div>
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">Mot de passe</p>
          <p className="text-xs text-ink-muted mb-4">Laissez vide pour ne pas modifier.</p>
          <div className="space-y-3">
            <input type="password" className="input" value={form.password} onChange={(e) => upd("password", e.target.value)} placeholder="Nouveau mot de passe" minLength={form.password ? 8 : undefined} />
            {form.password && <input type="password" className="input" value={form.confirm} onChange={(e) => upd("confirm", e.target.value)} placeholder="Confirmer le mot de passe" />}
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
          {loading ? "Enregistrement..." : "Sauvegarder →"}
        </button>
      </form>
    </div>
  );
}
