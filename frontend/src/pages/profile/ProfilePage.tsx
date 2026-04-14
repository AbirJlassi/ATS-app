/**
 * ProfilePage.tsx — Profil utilisateur
 * Page de modification des informations personnelles et du mot de passe.
 * Fond sombre cohérent avec les dashboards via DashboardLayout.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Phone, Building2, Lock, Check, AlertCircle, Shield } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import authService from "@/services/authService";
import DashboardLayout from "@/components/layout/DashboardLayout";

const ROLE_META: Record<string, { label: string; cls: string }> = {
  CANDIDAT: { label: "Candidat", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  RECRUTEUR: { label: "Recruteur", cls: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  ADMINISTRATEUR: { label: "Administrateur", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

/* ── Input sombre ── */
function DarkField({
  id, label, type = "text", placeholder, value, onChange, icon, readOnly,
}: {
  id: string; label: string; type?: string; placeholder: string;
  value: string; onChange?: (v: string) => void;
  icon: React.ReactNode; readOnly?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-500 dark:text-gray-600 dark:text-gray-600 dark:text-slate-400 mb-1.5">{label}</label>
      <div className={`flex items-center rounded-xl border transition-all duration-200 ${readOnly
          ? "bg-black/3 dark:bg-white/3 border-black/5 dark:border-white/5"
          : focused
            ? "bg-black/5 dark:bg-white/5 border-blue-500/50 ring-2 ring-blue-500/10"
            : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:border-black/15 dark:border-white/15"
        }`}>
        <div className={`pl-4 shrink-0 transition-colors duration-200 ${focused ? "text-blue-400" : "text-gray-500 dark:text-slate-600"}`}>
          {icon}
        </div>
        <input
          id={id} type={type} placeholder={placeholder} value={value}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className={`w-full bg-transparent px-3 py-3 text-sm focus:outline-none ${readOnly ? "text-gray-500 dark:text-slate-500 cursor-default" : "text-gray-700 dark:text-slate-200 placeholder:text-gray-500 dark:text-slate-600"
            }`}
        />
      </div>
    </div>
  );
}

/* ── Composant principal ── */
export default function ProfilePage() {
  const { user, setAuth } = useAuthStore();
  const [form, setForm] = useState({
    nom: user?.nom ?? "",
    prenom: user?.prenom ?? "",
    telephone: user?.telephone ?? "",
    departement: user?.departement ?? "",
    password: "",
    confirm: "",
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const upd = (f: string, v: string) => setForm((p) => ({ ...p, [f]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (form.password && form.password !== form.confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string> = {
        nom: form.nom, prenom: form.prenom,
        telephone: form.telephone, departement: form.departement,
      };
      if (form.password) payload.password = form.password;
      const updated = await authService.updateMe(payload);
      setAuth(updated, localStorage.getItem("access_token") ?? "");
      setSuccess(true);
      setForm((f) => ({ ...f, password: "", confirm: "" }));
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erreur.");
    } finally { setLoading(false); }
  };

  const roleMeta = ROLE_META[user?.role ?? ""] ?? { label: user?.role ?? "", cls: "bg-slate-500/20 text-gray-600 dark:text-slate-300 border-slate-500/30" };
  const initials = user?.prenom?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?";
  const displayName = user?.prenom && user?.nom ? `${user.prenom} ${user.nom}` : user?.email?.split("@")[0];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* ── En-tête ── */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">Compte</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mon profil</h1>
        </div>

        {/* ── Carte identité ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 mb-6 flex items-center gap-5"
        >
          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-gray-900 dark:text-white font-bold text-2xl shadow-md shrink-0">
            {initials}
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-xl">{displayName}</p>
            <p className="text-gray-500 dark:text-gray-600 dark:text-slate-400 text-sm mt-0.5">{user?.email}</p>
            <span className={`inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full border ${roleMeta.cls}`}>
              <Shield className="w-3 h-3" /> {roleMeta.label}
            </span>
          </div>
        </motion.div>

        {/* ── Alertes ── */}
        <AnimatePresence>
          {success && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-xl px-4 py-3 mb-5">
              <Check className="w-4 h-4 shrink-0" /> Profil mis à jour avec succès.
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Formulaire ── */}
        <motion.form
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          {/* Informations personnelles */}
          <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 space-y-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest">Informations personnelles</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DarkField id="p-prenom" label="Prénom" placeholder="Jean"
                value={form.prenom} onChange={(v) => upd("prenom", v)}
                icon={<User className="w-4 h-4" />} />
              <DarkField id="p-nom" label="Nom" placeholder="Dupont"
                value={form.nom} onChange={(v) => upd("nom", v)}
                icon={<User className="w-4 h-4" />} />
            </div>

            <DarkField id="p-email" label="Email" placeholder=""
              value={user?.email ?? ""} readOnly
              icon={<Mail className="w-4 h-4" />} />

            <DarkField id="p-phone" label="Téléphone" type="tel" placeholder="+216 XX XXX XXX"
              value={form.telephone} onChange={(v) => upd("telephone", v)}
              icon={<Phone className="w-4 h-4" />} />

            {user?.role === "RECRUTEUR" && (
              <DarkField id="p-dept" label="Département" placeholder="ex: Ressources Humaines"
                value={form.departement} onChange={(v) => upd("departement", v)}
                icon={<Building2 className="w-4 h-4" />} />
            )}
          </div>

          {/* Mot de passe */}
          <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 space-y-5">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest">Mot de passe</p>
              <p className="text-xs text-gray-500 dark:text-slate-600 mt-1">Laissez vide pour ne pas modifier.</p>
            </div>

            <DarkField id="p-pwd" label="Nouveau mot de passe" type="password" placeholder="8 caractères minimum"
              value={form.password} onChange={(v) => upd("password", v)}
              icon={<Lock className="w-4 h-4" />} />

            <AnimatePresence>
              {form.password && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <DarkField id="p-confirm" label="Confirmer le mot de passe" type="password" placeholder="••••••••"
                    value={form.confirm} onChange={(v) => upd("confirm", v)}
                    icon={<Lock className="w-4 h-4" />} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bouton submit */}
          <button type="submit" disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-blue-600 text-gray-900 dark:text-white font-semibold hover:bg-blue-500 transition-all shadow-md hover:shadow-[0_4px_20px_rgba(37,99,235,0.4)] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-sm"
          >
            {loading ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Enregistrement…</>
            ) : (
              <><Check className="w-4 h-4" /> Sauvegarder les modifications</>
            )}
          </button>
        </motion.form>
      </div>
    </DashboardLayout>
  );
}