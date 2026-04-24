import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, Users, Plus, Edit2, Trash2, Lock, Building2,
  X, ChevronDown, Loader2, Star, Trophy, Medal, Award, Sparkles,
} from "lucide-react";
import offreService from "@/services/offreService";
import candidatureService from "@/services/candidatureService";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import type { Offre, OffreCreate, StatutOffre, Candidature, StatutCandidature } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

/* ── Constants ── */
const DOMAINES = ["Informatique", "Finance", "Marketing", "RH", "Commercial", "Ingénierie", "Autre"];

const STATUT_OFFRE: Record<StatutOffre, { label: string; cls: string; dot: string }> = {
  PUBLIEE: { label: "Publiée", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500 dark:bg-emerald-400" },
  BROUILLON: { label: "Brouillon", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30", dot: "bg-slate-500 dark:bg-slate-400" },
  FERMEE: { label: "Fermée", cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", dot: "bg-red-500 dark:bg-red-400" },
};

type Tab = "mes-offres" | "candidatures";

const isPending = (c: Candidature) =>
  c.parse_statut === "EN_ATTENTE" || c.parse_statut === "EN_COURS";

/**
 * Tri des candidatures par match_score décroissant.
 * Les candidatures sans score calculé (parsing en cours/échec) sont
 * placées en fin de liste, par date de postulation décroissante.
 */
const sortCandsByScore = (list: Candidature[]): Candidature[] => {
  return [...list].sort((a, b) => {
    const aScored = a.parse_statut === "TERMINE" && typeof a.match_score === "number";
    const bScored = b.parse_statut === "TERMINE" && typeof b.match_score === "number";

    if (aScored && bScored) return (b.match_score ?? 0) - (a.match_score ?? 0);
    if (aScored) return -1;
    if (bScored) return 1;
    // Fallback : tri par date décroissante pour les non-scorés
    return (b.date_postulation ?? "").localeCompare(a.date_postulation ?? "");
  });
};

/* ── Couleurs associées au niveau de match ────────────────── */
const NIVEAU_TEXT: Record<string, string> = {
  EXCELLENT: "text-emerald-600 dark:text-emerald-400",
  BON: "text-blue-600 dark:text-blue-400",
  PARTIEL: "text-amber-600 dark:text-amber-400",
  FAIBLE: "text-red-600 dark:text-red-400",
};

/* ── Formulaire offre ── */
function OffreForm({ initial, onSubmit, onCancel, loading }: {
  initial?: Partial<OffreCreate>;
  onSubmit: (d: OffreCreate) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<OffreCreate>({
    titre: initial?.titre ?? "",
    description: initial?.description ?? "",
    domaine: initial?.domaine ?? "",
    competences_requises: initial?.competences_requises ?? [],
    annees_experience_min: initial?.annees_experience_min ?? 0,
    date_debut_souhaitee: initial?.date_debut_souhaitee ?? "",
  });
  const [ci, setCi] = useState("");

  const addC = () => {
    const v = ci.trim();
    if (v && !form.competences_requises.includes(v))
      setForm((f) => ({ ...f, competences_requises: [...f.competences_requises, v] }));
    setCi("");
  };

  const inputCls =
    "w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-700 dark:text-slate-200 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all";

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">Titre *</label>
          <input className={inputCls} value={form.titre}
            onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
            placeholder="ex: Développeur Full Stack" required />
        </div>
        <div className="relative">
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">Domaine *</label>
          <select className={inputCls + " appearance-none pr-8"} value={form.domaine}
            onChange={(e) => setForm((f) => ({ ...f, domaine: e.target.value }))} required>
            <option value="">Sélectionner</option>
            {DOMAINES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown className="absolute right-3 bottom-3 w-4 h-4 text-gray-500 dark:text-slate-500 pointer-events-none" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">Expérience min. (ans)</label>
          <input type="number" min={0} max={20} className={inputCls}
            value={form.annees_experience_min}
            onChange={(e) => setForm((f) => ({ ...f, annees_experience_min: +e.target.value }))} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">Description *</label>
          <textarea className={inputCls + " min-h-[90px] resize-y"} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Décrivez le poste…" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">Date de début</label>
          <input type="date" className={inputCls} value={form.date_debut_souhaitee ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, date_debut_souhaitee: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1.5">Compétences</label>
          <div className="flex gap-2">
            <input className={inputCls} value={ci} onChange={(e) => setCi(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addC(); } }}
              placeholder="React, Python…" />
            <button type="button" onClick={addC}
              className="px-3 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-600 dark:text-slate-300 text-sm hover:bg-black/10 dark:hover:bg-white/10 transition-all whitespace-nowrap">
              + Ajout
            </button>
          </div>
        </div>
        {form.competences_requises.length > 0 && (
          <div className="sm:col-span-2 flex flex-wrap gap-1.5">
            {form.competences_requises.map((c) => (
              <button key={c} type="button"
                onClick={() => setForm((f) => ({ ...f, competences_requises: f.competences_requises.filter((x) => x !== c) }))}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/25 transition-all">
                {c} <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          Annuler
        </button>
        <button type="submit" disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Publier l'offre →"}
        </button>
      </div>
    </form>
  );
}

/* ══════════════════════════════════════════════════════════════
   TopCandidatesPodium — Mise en valeur du top 3 des candidatures
   ══════════════════════════════════════════════════════════════
   Affiche les 1 à 3 meilleurs matchs (match_score décroissant)
   sous forme de cartes premium avec accent or / argent / bronze.
   Cliquable → page détail candidature.
*/
function TopCandidatesPodium({
  cands, onSelect,
}: {
  cands: Candidature[];
  onSelect: (id: string) => void;
}) {
  const top = cands
    .filter((c) => c.parse_statut === "TERMINE" && typeof c.match_score === "number")
    .slice(0, 3);

  if (top.length === 0) return null;

  const RANK_STYLES = [
    {
      // 1er — Or
      label: "1er",
      Icon: Trophy,
      ring: "ring-amber-400/40 dark:ring-amber-300/30",
      border: "border-amber-400/60 dark:border-amber-300/50",
      bg: "bg-gradient-to-br from-amber-50/80 via-white to-white dark:from-amber-400/[0.08] dark:via-slate-900/40 dark:to-slate-900/40",
      badgeBg: "bg-gradient-to-br from-amber-400 to-amber-600",
      iconColor: "text-white",
      glow: "shadow-[0_8px_40px_-8px_rgba(245,158,11,0.35)] dark:shadow-[0_8px_40px_-8px_rgba(251,191,36,0.22)]",
      textLabel: "text-amber-700 dark:text-amber-300",
    },
    {
      // 2e — Argent
      label: "2e",
      Icon: Medal,
      ring: "ring-slate-300/50 dark:ring-slate-400/20",
      border: "border-slate-300/70 dark:border-slate-400/30",
      bg: "bg-gradient-to-br from-slate-50/80 via-white to-white dark:from-slate-400/[0.06] dark:via-slate-900/40 dark:to-slate-900/40",
      badgeBg: "bg-gradient-to-br from-slate-300 to-slate-500",
      iconColor: "text-white",
      glow: "shadow-[0_6px_30px_-8px_rgba(100,116,139,0.25)]",
      textLabel: "text-slate-700 dark:text-slate-300",
    },
    {
      // 3e — Bronze
      label: "3e",
      Icon: Award,
      ring: "ring-orange-400/40 dark:ring-orange-300/20",
      border: "border-orange-400/50 dark:border-orange-400/25",
      bg: "bg-gradient-to-br from-orange-50/80 via-white to-white dark:from-orange-400/[0.05] dark:via-slate-900/40 dark:to-slate-900/40",
      badgeBg: "bg-gradient-to-br from-orange-400 to-amber-700",
      iconColor: "text-white",
      glow: "shadow-[0_6px_30px_-8px_rgba(234,88,12,0.25)]",
      textLabel: "text-orange-700 dark:text-orange-300",
    },
  ];

  const gridCols =
    top.length === 1 ? "grid-cols-1 max-w-md" :
      top.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="mb-7"
    >
      {/* Heading */}
      <div className="flex items-center gap-2 mb-3.5">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-[0.14em]">
          Top {top.length} — Meilleur{top.length > 1 ? "s" : ""} match{top.length > 1 ? "s" : ""}
        </h3>
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">
          · classés par score de matching
        </span>
      </div>

      {/* Cartes podium */}
      <div className={`grid ${gridCols} gap-3`}>
        {top.map((c, idx) => {
          const s = RANK_STYLES[idx];
          const RankIcon = s.Icon;
          const initial = c.candidat_prenom?.[0]?.toUpperCase()
            ?? c.candidat_email?.[0]?.toUpperCase() ?? "?";
          const niveauCls = NIVEAU_TEXT[c.match_niveau ?? ""] ?? "text-gray-500";

          return (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: idx * 0.08, ease: "easeOut" }}
              whileHover={{ y: -3 }}
              onClick={() => onSelect(c.id)}
              className={`text-left relative overflow-hidden rounded-2xl border ${s.border} ${s.bg} ${s.glow}
                          p-5 ring-1 ${s.ring} cursor-pointer group
                          transition-all duration-300 hover:shadow-xl backdrop-blur-sm`}
            >
              {/* Ornement — trait vertical coloré à gauche */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.badgeBg}`} aria-hidden="true" />

              {/* Ligne 1 : rang + niveau */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl ${s.badgeBg} flex items-center justify-center shadow-sm`}>
                    <RankIcon className={`w-[18px] h-[18px] ${s.iconColor}`} strokeWidth={2.2} />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${s.textLabel}`}>
                    {s.label}
                  </span>
                </div>
                {c.match_niveau && (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 ${niveauCls}`}>
                    {c.match_niveau}
                  </span>
                )}
              </div>

              {/* Ligne 2 : avatar + nom + email */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-black/10 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base shrink-0">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {c.candidat_prenom} {c.candidat_nom}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 truncate">
                    {c.candidat_email}
                  </p>
                </div>
              </div>

              {/* Ligne 3 : score + skills */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${niveauCls}`}>
                    {c.match_score}
                  </span>
                  <span className={`text-sm font-semibold ${niveauCls}`}>%</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-600 uppercase tracking-wider ml-1 font-semibold">
                    match
                  </span>
                </div>
                {c.cv_data?.skills && c.cv_data.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {c.cv_data.skills.slice(0, 2).map((sk) => (
                      <span key={sk}
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-black/10 dark:border-white/10">
                        {sk}
                      </span>
                    ))}
                    {c.cv_data.skills.length > 2 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/5 text-gray-400 dark:text-slate-600 border border-black/10 dark:border-white/10">
                        +{c.cv_data.skills.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Chevron au survol */}
              <div className="absolute bottom-3 right-4 text-gray-400 dark:text-slate-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                Voir profil →
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── Dashboard principal ── */
export default function RecruiterDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>(
    (searchParams.get("tab") as Tab) ?? "mes-offres"
  );

  useEffect(() => {
    const t = searchParams.get("tab") as Tab;
    if (t && t !== tab) setTab(t);

    // Restore candidatures grid when coming back from a detail page
    const offreId = searchParams.get("offreId");
    if (offreId && offreId !== selOffreId) {
      fetchCands(offreId);
    }
  }, [searchParams]);

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    navigate(`/recruiter/dashboard?tab=${newTab}`, { replace: true });
  };

  const [mesOffres, setMesOffres] = useState<Offre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editOffre, setEditOffre] = useState<Offre | null>(null);
  const [actionLoading, setAL] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  /* Candidatures tab */
  const [selOffreId, setSelOffreId] = useState<string | null>(null);
  const [cands, setCands] = useState<Candidature[]>([]);
  const [candLoading, setCL] = useState(false);

  const listPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Polling liste candidatures */
  useEffect(() => {
    if (listPollingRef.current) { clearInterval(listPollingRef.current); listPollingRef.current = null; }
    const hasPending = cands.some(isPending);
    if (!hasPending || !selOffreId) return;
    listPollingRef.current = setInterval(async () => {
      try {
        const fresh = await candidatureService.candidaturesOffre(selOffreId);
        setCands(sortCandsByScore(fresh));
        if (!fresh.some(isPending)) { clearInterval(listPollingRef.current!); listPollingRef.current = null; }
      } catch { /* silencieux — géré par le toast ailleurs */ }
    }, 4000);
    return () => { if (listPollingRef.current) { clearInterval(listPollingRef.current); listPollingRef.current = null; } };
  }, [cands, selOffreId]);

  useEffect(() => () => { if (listPollingRef.current) clearInterval(listPollingRef.current); }, []);

  /* Fetchers */
  useEffect(() => { fetchMes(); }, []);

  const fetchMes = async () => {
    try {
      setLoading(true);
      setMesOffres(await offreService.mesOffres());
    } catch {
      toast.error("Impossible de charger vos offres", "Vérifiez votre connexion et réessayez.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCands = async (id: string) => {
    setCL(true);
    setSelOffreId(id);
    try {
      const fresh = await candidatureService.candidaturesOffre(id);
      setCands(sortCandsByScore(fresh));
    } catch {
      toast.error("Impossible de charger les candidatures");
    } finally {
      setCL(false);
    }
  };

  /* Actions */
  const handleCreate = async (d: OffreCreate) => {
    setAL(true);
    try {
      const o = await offreService.create(d);
      setMesOffres((p) => [o, ...p]);
      setShowForm(false);
      toast.success("Offre publiée", `« ${o.titre} » est désormais visible par les candidats.`);
    } catch {
      toast.error("Erreur lors de la création", "Veuillez vérifier les informations saisies.");
    } finally {
      setAL(false);
    }
  };

  const handleUpdate = async (d: OffreCreate) => {
    if (!editOffre) return;
    setAL(true);
    try {
      const u = await offreService.update(editOffre.id, d);
      setMesOffres((p) => p.map((o) => (o.id === editOffre.id ? u : o)));
      setEditOffre(null);
      toast.success("Offre mise à jour", `« ${u.titre} » a été modifiée.`);
    } catch {
      toast.error("Erreur lors de la modification");
    } finally {
      setAL(false);
    }
  };

  const handleDelete = async (id: string) => {
    const target = mesOffres.find((o) => o.id === id);
    setAL(true);
    try {
      await offreService.delete(id);
      setMesOffres((p) => p.filter((o) => o.id !== id));
      toast.success("Offre supprimée", target ? `« ${target.titre} » a été supprimée.` : undefined);
    } catch {
      toast.error("Erreur lors de la suppression");
    } finally {
      setAL(false);
      setConfirmDel(null);
    }
  };

  const handleFermer = async (id: string) => {
    try {
      const u = await offreService.update(id, { statut: "FERMEE" });
      setMesOffres((p) => p.map((o) => (o.id === id ? u : o)));
      toast.info("Offre fermée", `« ${u.titre} » n'accepte plus de nouvelles candidatures.`);
    } catch {
      toast.error("Erreur lors de la fermeture");
    }
  };

  const handleCandStatut = async (cId: string, s: StatutCandidature) => {
    try {
      const u = await candidatureService.updateStatut(cId, s);
      // Le score ne change pas → pas besoin de re-sort
      setCands((p) => p.map((c) => (c.id === cId ? u : c)));
      const labels: Record<StatutCandidature, { label: string; type: "success" | "info" | "warning" }> = {
        ACCEPTEE: { label: "Candidature acceptée", type: "success" },
        REFUSEE: { label: "Candidature refusée", type: "warning" },
        EN_COURS_EXAMEN: { label: "Candidature en cours d'examen", type: "info" },
        SOUMISE: { label: "Statut remis à « soumise »", type: "info" },
      };
      const meta = labels[s];
      toast[meta.type](meta.label, u.candidat_prenom ? `${u.candidat_prenom} ${u.candidat_nom ?? ""}` : undefined);
    } catch {
      toast.error("Erreur lors de la mise à jour du statut");
    }
  };

  const selOffre = mesOffres.find((o) => o.id === selOffreId);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Espace Recruteur</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Bonjour, {user?.prenom ?? user?.email?.split("@")[0]} 👋
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <p className="text-gray-500 dark:text-slate-400 text-sm">Gérez vos offres et vos candidatures reçues.</p>
              {user?.departement && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                  <Building2 className="w-3.5 h-3.5" />
                  {user.departement}
                </span>
              )}
            </div>
          </div>
          {tab === "mes-offres" && !showForm && !editOffre && (
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-all shadow-md hover:shadow-[0_4px_20px_rgba(37,99,235,0.4)] shrink-0 active:scale-[0.98]">
              <Plus className="w-4 h-4" /> Publier une offre
            </button>
          )}
        </div>

        {/* ── Onglets horizontaux ── */}
        <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-black/10 dark:border-white/10 w-fit mb-7">
          {([
            { key: "mes-offres", label: "Mes offres", icon: <Briefcase className="w-4 h-4" />, count: mesOffres.length },
            { key: "candidatures", label: "Candidatures", icon: <Users className="w-4 h-4" />, count: null },
          ] as const).map((t) => (
            <button key={t.key}
              onClick={() => switchTab(t.key)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${tab === t.key
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              {t.icon} {t.label}
              {t.count !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-white/20 text-white" : "bg-black/10 dark:bg-white/10 text-gray-500 dark:text-slate-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── TAB : Mes offres ── */}
        {tab === "mes-offres" && (
          <>
            <AnimatePresence>
              {showForm && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-5">Nouvelle offre</p>
                  <OffreForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} loading={actionLoading} />
                </motion.div>
              )}
              {editOffre && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                  className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-5">Modifier l'offre</p>
                  <OffreForm
                    initial={{ ...editOffre, date_debut_souhaitee: editOffre.date_debut_souhaitee ?? undefined }}
                    onSubmit={handleUpdate} onCancel={() => setEditOffre(null)} loading={actionLoading}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {loading ? (
              <div className="flex items-center justify-center gap-3 py-20 text-gray-500 dark:text-slate-400">
                <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                Chargement...
              </div>
            ) : mesOffres.length === 0 ? (
              <div className="text-center py-20 bg-white/40 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                <Briefcase className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-slate-400 mb-4">Aucune offre publiée.</p>
                <button onClick={() => setShowForm(true)}
                  className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-all">
                  Publier ma première offre
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {mesOffres.map((o, i) => (
                  <motion.div key={o.id}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.05 }}
                    className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-blue-500/30 dark:hover:border-blue-500/30 rounded-2xl p-5 transition-all duration-200 hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(59,130,246,0.08)] group cursor-pointer backdrop-blur-sm"
                    onClick={() => navigate(`/recruiter/offres/${o.id}`)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUT_OFFRE[o.statut].cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUT_OFFRE[o.statut].dot}`} />
                            {STATUT_OFFRE[o.statut].label}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-black/10 dark:border-white/10">
                            {o.domaine}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {o.titre}
                        </h3>
                        <p className="text-gray-500 dark:text-slate-400 text-sm line-clamp-2 mb-3">{o.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {o.competences_requises.slice(0, 5).map((c) => (
                            <span key={c} className="px-2 py-0.5 rounded-md text-xs bg-black/5 dark:bg-white/5 text-gray-500 dark:text-slate-500 border border-black/10 dark:border-white/10">{c}</span>
                          ))}
                          {o.competences_requises.length > 5 && (
                            <span className="px-2 py-0.5 rounded-md text-xs bg-black/5 dark:bg-white/5 text-gray-500 dark:text-slate-500 border border-black/10 dark:border-white/10">
                              +{o.competences_requises.length - 5}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <div className="flex flex-col gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { switchTab("candidatures"); fetchCands(o.id); }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-600 dark:text-slate-300 text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                        >
                          <Users className="w-3.5 h-3.5" /> Candidatures
                        </button>
                        <button onClick={() => setEditOffre(o)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-600 dark:text-slate-300 text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-all">
                          <Edit2 className="w-3.5 h-3.5" /> Modifier
                        </button>
                        {o.statut === "PUBLIEE" && (
                          <button onClick={() => handleFermer(o.id)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all">
                            <Lock className="w-3.5 h-3.5" /> Fermer
                          </button>
                        )}
                        <button onClick={() => setConfirmDel(o.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                        <div className="flex items-center gap-1 px-2 py-1 text-gray-400 dark:text-slate-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity justify-center">
                          Voir détail →
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TAB : Candidatures ── */}
        {tab === "candidatures" && (
          <>
            <div className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-5 mb-5 flex items-center gap-4 backdrop-blur-sm">
              <label className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide whitespace-nowrap">Offre :</label>
              <div className="relative flex-1">
                <select
                  className="w-full appearance-none bg-black/5 dark:bg-slate-800 border border-black/10 dark:border-white/10 rounded-xl px-4 py-2.5 pr-9 text-sm text-gray-700 dark:text-slate-200 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer dark:[color-scheme:dark] [&>option]:bg-white [&>option]:text-gray-800 dark:[&>option]:bg-slate-800 dark:[&>option]:text-slate-200"
                  value={selOffreId ?? ""}
                  onChange={(e) => e.target.value && fetchCands(e.target.value)}
                >
                  <option value="">Sélectionner une offre</option>
                  {mesOffres.map((o) => <option key={o.id} value={o.id}>{o.titre}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-500 pointer-events-none" />
              </div>
            </div>

            {!selOffreId ? (
              <div className="text-center py-20 bg-white/40 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10 text-gray-500 dark:text-slate-500 text-sm">
                Sélectionnez une offre pour voir ses candidatures.
              </div>
            ) : candLoading ? (
              <div className="flex items-center justify-center gap-3 py-20 text-gray-500 dark:text-slate-400">
                <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                Chargement...
              </div>
            ) : cands.length === 0 ? (
              <div className="text-center py-20 bg-white/40 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                <Users className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-slate-400 text-sm">Aucune candidature pour <strong className="text-gray-600 dark:text-slate-300">{selOffre?.titre}</strong>.</p>
              </div>
            ) : (
              <>
                {/* ── Podium Top 3 (ranking visuel) ── */}
                <TopCandidatesPodium
                  cands={cands}
                  onSelect={(id) => navigate(`/recruiter/candidatures/${id}`)}
                />

                {/* ── Stats en-tête ── */}
                <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 flex items-center gap-2 flex-wrap">
                  <strong className="text-gray-900 dark:text-white">{cands.length}</strong> candidature{cands.length > 1 ? "s" : ""} pour{" "}
                  <strong className="text-gray-900 dark:text-white">{selOffre?.titre}</strong>
                  <span className="text-xs text-gray-400 dark:text-slate-600">· triées par score de matching</span>
                  {cands.some(isPending) && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
                      <div className="w-3 h-3 rounded-full border border-blue-400 border-t-transparent animate-spin" />
                      Analyse IA en cours…
                    </span>
                  )}
                </p>

                {/* ── Liste complète ── */}
                <div className="space-y-3">
                  {cands.map((c, i) => {
                    const rank = c.parse_statut === "TERMINE" && typeof c.match_score === "number"
                      ? cands.filter((x) => x.parse_statut === "TERMINE" && typeof x.match_score === "number")
                        .findIndex((x) => x.id === c.id) + 1
                      : null;

                    return (
                      <motion.div key={c.id}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.04 }}
                        className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-blue-500/30 rounded-2xl p-5 cursor-pointer hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(59,130,246,0.08)] transition-all duration-200 group backdrop-blur-sm"
                        onClick={() => navigate(`/recruiter/candidatures/${c.id}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Avatar + éventuel rang */}
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-black/10 dark:border-white/10 flex items-center justify-center text-blue-400 font-bold text-sm">
                                {c.candidat_prenom?.[0]?.toUpperCase() ?? c.candidat_email?.[0]?.toUpperCase() ?? "?"}
                              </div>
                              {rank !== null && rank <= 3 && (
                                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-sm ${rank === 1 ? "bg-gradient-to-br from-amber-400 to-amber-600" :
                                    rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-500" :
                                      "bg-gradient-to-br from-orange-400 to-amber-700"
                                  }`}>
                                  {rank}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {c.candidat_prenom} {c.candidat_nom}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{c.candidat_email}</p>
                              {c.parse_statut === "TERMINE" && c.cv_data?.skills && c.cv_data.skills.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {c.cv_data.skills.slice(0, 4).map((s) => (
                                    <span key={s} className="px-2 py-0.5 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/15">{s}</span>
                                  ))}
                                  {c.cv_data.skills.length > 4 && (
                                    <span className="px-2 py-0.5 rounded-md text-xs bg-black/5 dark:bg-white/5 text-gray-500 dark:text-slate-500 border border-black/10 dark:border-white/10">
                                      +{c.cv_data.skills.length - 4}
                                    </span>
                                  )}
                                </div>
                              )}
                              {isPending(c) && (
                                <p className="text-xs text-blue-400 mt-1 flex items-center gap-1.5">
                                  <span className="w-3 h-3 rounded-full border border-blue-400 border-t-transparent animate-spin" />
                                  Analyse IA en cours…
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {c.parse_statut === "TERMINE" && c.match_score !== undefined && c.match_niveau !== undefined && (
                              <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 ${c.match_niveau === "EXCELLENT" ? "text-emerald-600 dark:text-emerald-400" :
                                  c.match_niveau === "BON" ? "text-blue-600 dark:text-blue-400" :
                                    c.match_niveau === "PARTIEL" ? "text-amber-600 dark:text-amber-400" :
                                      "text-red-600 dark:text-red-400"
                                }`}>
                                <Star className="w-3 h-3" /> {c.match_score}%
                              </span>
                            )}
                            <div className="relative">
                              <select
                                className="appearance-none pl-3 pr-8 py-1.5 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-xs text-gray-800 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer transition-all dark:[color-scheme:dark]"
                                value={c.statut}
                                onChange={(e) => handleCandStatut(c.id, e.target.value as StatutCandidature)}
                              >
                                <option value="SOUMISE">Soumise</option>
                                <option value="EN_COURS_EXAMEN">En cours</option>
                                <option value="ACCEPTEE">Acceptée ✓</option>
                                <option value="REFUSEE">Refusée ✕</option>
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-slate-500 pointer-events-none" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Modal confirm suppression offre ── */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => setConfirmDel(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">Supprimer cette offre ?</h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm text-center mb-7">Les candidatures associées seront également supprimées.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDel(null)}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                  Annuler
                </button>
                <button onClick={() => handleDelete(confirmDel)} disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}