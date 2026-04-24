import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Briefcase, Users, Edit2, Trash2, Lock,
  ChevronDown, AlertCircle, Loader2, X, Calendar,
  Star, Trophy, Medal, Award, Sparkles,
} from "lucide-react";
import offreService from "@/services/offreService";
import candidatureService from "@/services/candidatureService";
import { useAuthStore } from "@/store/authStore";
import type { Offre, OffreCreate, StatutOffre, Candidature, StatutCandidature } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

/* ── Constants ── */
const DOMAINES = ["Informatique", "Finance", "Marketing", "RH", "Commercial", "Ingénierie", "Autre"];

const STATUT_OFFRE: Record<StatutOffre, { label: string; cls: string; dot: string }> = {
  PUBLIEE: { label: "Publiée", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  BROUILLON: { label: "Brouillon", cls: "bg-slate-500/15 text-slate-400 border-slate-500/30", dot: "bg-slate-400" },
  FERMEE: { label: "Fermée", cls: "bg-red-500/15 text-red-400 border-red-500/30", dot: "bg-red-400" },
};


const isPending = (c: Candidature) =>
  c.parse_statut === "EN_ATTENTE" || c.parse_statut === "EN_COURS";

const sortCandsByScore = (list: Candidature[]): Candidature[] =>
  [...list].sort((a, b) => {
    const aS = a.parse_statut === "TERMINE" && typeof a.match_score === "number";
    const bS = b.parse_statut === "TERMINE" && typeof b.match_score === "number";
    if (aS && bS) return (b.match_score ?? 0) - (a.match_score ?? 0);
    if (aS) return -1;
    if (bS) return 1;
    return (b.date_postulation ?? "").localeCompare(a.date_postulation ?? "");
  });

const NIVEAU_TEXT: Record<string, string> = {
  EXCELLENT: "text-emerald-600 dark:text-emerald-400",
  BON: "text-blue-600 dark:text-blue-400",
  PARTIEL: "text-amber-600 dark:text-amber-400",
  FAIBLE: "text-red-600 dark:text-red-400",
};

function TopCandidatesPodium({ cands, onSelect }: { cands: Candidature[]; onSelect: (id: string) => void }) {
  const top = cands
    .filter((c) => c.parse_statut === "TERMINE" && typeof c.match_score === "number")
    .slice(0, 3);
  if (top.length === 0) return null;

  const RANK_STYLES = [
    { label: "1er", Icon: Trophy, ring: "ring-amber-400/40", border: "border-amber-400/60", bg: "bg-gradient-to-br from-amber-50/80 via-white to-white dark:from-amber-400/[0.08] dark:via-slate-900/40 dark:to-slate-900/40", badgeBg: "bg-gradient-to-br from-amber-400 to-amber-600", iconColor: "text-white", glow: "shadow-[0_8px_40px_-8px_rgba(245,158,11,0.35)]", textLabel: "text-amber-700 dark:text-amber-300" },
    { label: "2e", Icon: Medal, ring: "ring-slate-300/50", border: "border-slate-300/70 dark:border-slate-400/30", bg: "bg-gradient-to-br from-slate-50/80 via-white to-white dark:from-slate-400/[0.06] dark:via-slate-900/40 dark:to-slate-900/40", badgeBg: "bg-gradient-to-br from-slate-300 to-slate-500", iconColor: "text-white", glow: "shadow-[0_6px_30px_-8px_rgba(100,116,139,0.25)]", textLabel: "text-slate-700 dark:text-slate-300" },
    { label: "3e", Icon: Award, ring: "ring-orange-400/40", border: "border-orange-400/50 dark:border-orange-400/25", bg: "bg-gradient-to-br from-orange-50/80 via-white to-white dark:from-orange-400/[0.05] dark:via-slate-900/40 dark:to-slate-900/40", badgeBg: "bg-gradient-to-br from-orange-400 to-amber-700", iconColor: "text-white", glow: "shadow-[0_6px_30px_-8px_rgba(234,88,12,0.25)]", textLabel: "text-orange-700 dark:text-orange-300" },
  ];
  const gridCols = top.length === 1 ? "grid-cols-1 max-w-md" : top.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-7">
      <div className="flex items-center gap-2 mb-3.5">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase tracking-[0.14em]">Top {top.length} — Meilleur{top.length > 1 ? "s" : ""} match{top.length > 1 ? "s" : ""}</h3>
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">· classés par score de matching</span>
      </div>
      <div className={`grid ${gridCols} gap-3`}>
        {top.map((c, idx) => {
          const s = RANK_STYLES[idx];
          const RankIcon = s.Icon;
          const initial = c.candidat_prenom?.[0]?.toUpperCase() ?? c.candidat_email?.[0]?.toUpperCase() ?? "?";
          const niveauCls = NIVEAU_TEXT[c.match_niveau ?? ""] ?? "text-gray-500";
          return (
            <motion.button key={c.id} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, delay: idx * 0.08 }} whileHover={{ y: -3 }} onClick={() => onSelect(c.id)}
              className={`text-left relative overflow-hidden rounded-2xl border ${s.border} ${s.bg} ${s.glow} p-5 ring-1 ${s.ring} cursor-pointer group transition-all duration-300 hover:shadow-xl backdrop-blur-sm`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.badgeBg}`} aria-hidden="true" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl ${s.badgeBg} flex items-center justify-center shadow-sm`}>
                    <RankIcon className={`w-[18px] h-[18px] ${s.iconColor}`} strokeWidth={2.2} />
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${s.textLabel}`}>{s.label}</span>
                </div>
                {c.match_niveau && <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 ${niveauCls}`}>{c.match_niveau}</span>}
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-black/10 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-base shrink-0">{initial}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.candidat_prenom} {c.candidat_nom}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{c.candidat_email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-bold tabular-nums ${niveauCls}`}>{c.match_score}</span>
                  <span className={`text-sm font-semibold ${niveauCls}`}>%</span>
                  <span className="text-[10px] text-gray-400 dark:text-slate-600 uppercase tracking-wider ml-1 font-semibold">match</span>
                </div>
                {c.cv_data?.skills && c.cv_data.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {c.cv_data.skills.slice(0, 2).map((sk) => (
                      <span key={sk} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-black/10 dark:border-white/10">{sk}</span>
                    ))}
                    {c.cv_data.skills.length > 2 && <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/5 dark:bg-white/5 text-gray-400 dark:text-slate-600 border border-black/10 dark:border-white/10">+{c.cv_data.skills.length - 2}</span>}
                  </div>
                )}
              </div>
              <div className="absolute bottom-3 right-4 text-gray-400 dark:text-slate-600 text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">Voir profil →</div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ── Inline Edit Form ── */
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
          <textarea className={inputCls + " min-h-[100px] resize-y"} value={form.description}
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
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement…</> : "Sauvegarder →"}
        </button>
      </div>
    </form>
  );
}

/* ── Page principale ── */
export default function OffreDetailPage() {
  const { id: offreId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [offre, setOffre] = useState<Offre | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const [cands, setCands] = useState<Candidature[]>([]);
  const [candsLoading, setCandsLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch offre ── */
  useEffect(() => {
    if (!offreId) return;
    (async () => {
      setLoading(true);
      try {
        const o = await offreService.getById(offreId);
        setOffre(o);
      } catch {
        setError("Impossible de charger cette offre.");
      } finally {
        setLoading(false);
      }
    })();
  }, [offreId]);

  /* ── Fetch candidatures ── */
  useEffect(() => {
    if (!offreId) return;
    (async () => {
      setCandsLoading(true);
      try {
        const list = await candidatureService.candidaturesOffre(offreId);
        setCands(sortCandsByScore(list));
      } catch { /* pas forcément recruteur propriétaire */ }
      finally { setCandsLoading(false); }
    })();
  }, [offreId]);

  /* ── Polling parse en cours ── */
  useEffect(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (!offreId || !cands.some(isPending)) return;
    pollingRef.current = setInterval(async () => {
      try {
        const fresh = await candidatureService.candidaturesOffre(offreId!);
        setCands(sortCandsByScore(fresh));
        if (!fresh.some(isPending)) { clearInterval(pollingRef.current!); pollingRef.current = null; }
      } catch { /* silencieux */ }
    }, 4000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [cands, offreId]);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  /* ── Actions ── */
  const handleUpdate = async (d: OffreCreate) => {
    if (!offre) return;
    setActionLoading(true);
    try {
      const u = await offreService.update(offre.id, d);
      setOffre(u);
      setEditing(false);
    } catch { setError("Erreur lors de la modification."); }
    finally { setActionLoading(false); }
  };

  const handleFermer = async () => {
    if (!offre) return;
    try {
      const u = await offreService.update(offre.id, { statut: "FERMEE" });
      setOffre(u);
    } catch { setError("Erreur."); }
  };

  const handleDelete = async () => {
    if (!offre) return;
    setActionLoading(true);
    try {
      await offreService.delete(offre.id);
      navigate("/recruiter/dashboard?tab=mes-offres", { replace: true });
    } catch { setError("Erreur lors de la suppression."); }
    finally { setActionLoading(false); setConfirmDel(false); }
  };

  const handleCandStatut = async (cId: string, s: StatutCandidature) => {
    try {
      const u = await candidatureService.updateStatut(cId, s);
      setCands((p) => p.map((c) => (c.id === cId ? u : c)));
    } catch { setError("Erreur lors de la mise à jour."); }
  };

  /* ── Render ── */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !offre) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">{error}</p>
          <button onClick={() => navigate("/recruiter/dashboard?tab=mes-offres")}
            className="mt-6 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-all">
            ← Retour aux offres
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const isOwner = offre?.recruteur_id === user?.id;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ── */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-8">
          <Link
            to="/recruiter/dashboard?tab=mes-offres"
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Mes offres
          </Link>
          <span className="text-gray-400 dark:text-slate-600">/</span>
          <span className="text-sm text-gray-900 dark:text-white font-medium truncate max-w-xs">{offre?.titre}</span>
        </motion.div>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-between bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
              <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {offre && (
          <>
            {/* ── Offre card ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">

              {!editing ? (
                <>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${STATUT_OFFRE[offre.statut].cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUT_OFFRE[offre.statut].dot}`} />
                          {STATUT_OFFRE[offre.statut].label}
                        </span>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                          {offre.domaine}
                        </span>
                        {offre.annees_experience_min > 0 && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-black/10 dark:border-white/10 flex items-center gap-1">
                            <Star className="w-3 h-3" /> {offre.annees_experience_min} ans min.
                          </span>
                        )}
                        {offre.date_debut_souhaitee && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-400 border border-black/10 dark:border-white/10 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> {new Date(offre.date_debut_souhaitee).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{offre.titre}</h1>
                      <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed whitespace-pre-wrap mb-4">{offre.description}</p>
                      {offre.competences_requises.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {offre.competences_requises.map((c) => (
                            <span key={c} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {isOwner && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button onClick={() => setEditing(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-gray-600 dark:text-slate-300 text-xs font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-all">
                          <Edit2 className="w-3.5 h-3.5" /> Modifier
                        </button>
                        {offre.statut === "PUBLIEE" && (
                          <button onClick={handleFermer}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all">
                            <Lock className="w-3.5 h-3.5" /> Fermer
                          </button>
                        )}
                        <button onClick={() => setConfirmDel(true)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all">
                          <Trash2 className="w-3.5 h-3.5" /> Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-5">Modifier l'offre</p>
                  <OffreForm
                    initial={{ ...offre, date_debut_souhaitee: offre.date_debut_souhaitee ?? undefined }}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditing(false)}
                    loading={actionLoading}
                  />
                </motion.div>
              )}
            </motion.div>

            {/* ── Candidatures section ── */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Candidatures
                </h2>
                {cands.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">
                    {cands.length}
                  </span>
                )}
                {cands.some(isPending) && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-blue-400">
                    <div className="w-3 h-3 rounded-full border border-blue-400 border-t-transparent animate-spin" />
                    Analyse IA en cours…
                  </span>
                )}
              </div>

              {candsLoading ? (
                <div className="flex items-center justify-center gap-3 py-16 bg-white/40 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  <span className="text-gray-500 dark:text-slate-400 text-sm">Chargement…</span>
                </div>
              ) : cands.length === 0 ? (
                <div className="text-center py-20 bg-white/40 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                  <Users className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400 text-sm">Aucune candidature pour cette offre.</p>
                </div>
              ) : (
                <>
                  {/* ── Podium Top 3 ── */}
                  <TopCandidatesPodium
                    cands={cands}
                    onSelect={(id) => navigate(`/recruiter/candidatures/${id}`)}
                  />

                  {/* ── Stats ── */}
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 flex items-center gap-2 flex-wrap">
                    <strong className="text-gray-900 dark:text-white">{cands.length}</strong> candidature{cands.length > 1 ? "s" : ""}
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
                        ? cands.filter((x) => x.parse_statut === "TERMINE" && typeof x.match_score === "number").findIndex((x) => x.id === c.id) + 1
                        : null;
                      return (
                        <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-4 group hover:border-blue-500/30 transition-all duration-200 cursor-pointer hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(59,130,246,0.08)] backdrop-blur-sm"
                          onClick={() => navigate(`/recruiter/candidatures/${c.id}`)}>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="relative shrink-0">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-black/10 dark:border-white/10 flex items-center justify-center text-blue-400 font-bold text-sm">
                                  {c.candidat_prenom?.[0]?.toUpperCase() ?? c.candidat_email?.[0]?.toUpperCase() ?? "?"}
                                </div>
                                {rank !== null && rank <= 3 && (
                                  <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white shadow-sm ${
                                    rank === 1 ? "bg-gradient-to-br from-amber-400 to-amber-600" :
                                    rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-500" :
                                    "bg-gradient-to-br from-orange-400 to-amber-700"}`}>{rank}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.candidat_prenom} {c.candidat_nom}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{c.candidat_email}</p>
                                {c.parse_statut === "TERMINE" && c.cv_data?.skills && c.cv_data.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {c.cv_data.skills.slice(0, 4).map((s) => <span key={s} className="px-2 py-0.5 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/15">{s}</span>)}
                                    {c.cv_data.skills.length > 4 && <span className="px-2 py-0.5 rounded-md text-xs bg-black/5 dark:bg-white/5 text-gray-500 dark:text-slate-500 border border-black/10 dark:border-white/10">+{c.cv_data.skills.length - 4}</span>}
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
                                <span className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 ${
                                  c.match_niveau === "EXCELLENT" ? "text-emerald-600 dark:text-emerald-400" :
                                  c.match_niveau === "BON" ? "text-blue-600 dark:text-blue-400" :
                                  c.match_niveau === "PARTIEL" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                                  <Star className="w-3 h-3" /> {c.match_score}%
                                </span>
                              )}
                              <div className="relative">
                                <select className="appearance-none pl-3 pr-8 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-xs text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer transition-all dark:[color-scheme:dark]"
                                  value={c.statut} onChange={(e) => handleCandStatut(c.id, e.target.value as StatutCandidature)}>
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
            </motion.div>
          </>
        )}
      </div>

      {/* ── Confirm delete modal ── */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => setConfirmDel(false)}>
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
              <p className="text-gray-500 dark:text-slate-400 text-sm text-center mb-7">Les candidatures associées seront également supprimées. Cette action est irréversible.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                  Annuler
                </button>
                <button onClick={handleDelete} disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}