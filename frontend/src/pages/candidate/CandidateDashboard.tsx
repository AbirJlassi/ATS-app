/**
 * CandidateDashboard.tsx — Espace candidat
 * Navigation vers pages dédiées pour offres et candidatures.
 * Domaines filtrés dynamiquement depuis la base.
 */
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, ClipboardList, X, ChevronRight,
  CheckCircle2, Clock, XCircle, FileText, Search,
} from "lucide-react";
import offreService from "@/services/offreService";
import candidatureService from "@/services/candidatureService";
import { useAuthStore } from "@/store/authStore";
import type { Offre, Candidature, StatutCandidature } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

/* ── Config statuts ── */
const STATUT_CONFIG: Record<StatutCandidature, { label: string; icon: React.ReactNode; cls: string }> = {
  SOUMISE: { label: "Soumise", icon: <Clock className="w-3 h-3" />, cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  EN_COURS_EXAMEN: { label: "En cours d'examen", icon: <Search className="w-3 h-3" />, cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  ACCEPTEE: { label: "Acceptée", icon: <CheckCircle2 className="w-3 h-3" />, cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  REFUSEE: { label: "Refusée", icon: <XCircle className="w-3 h-3" />, cls: "bg-red-500/20 text-red-300 border-red-500/30" },
};

type Tab = "offres" | "candidatures";

/* ── Carte statistique ── */
function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${color}`}>
      <div className="w-10 h-10 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-700 dark:text-white/60 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ── Composant principal ── */
export default function CandidateDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>(
    (searchParams.get("tab") as Tab) ?? "offres"
  );

  useEffect(() => {
    const t = searchParams.get("tab") as Tab;
    if (t && t !== tab) setTab(t);
  }, [searchParams]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  const [offres, setOffres] = useState<Offre[]>([]);
  const [candidatures, setCandidatures] = useState<Candidature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDomaine, setFilterDomaine] = useState("Tous");
  const [domaines, setDomaines] = useState<string[]>([]);

  const candByOffreId = new Map(candidatures.map((c) => [c.offre_id, c]));

  useEffect(() => { fetchOffres(); fetchCandidatures(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOffres(); }, [filterDomaine]);

  const fetchOffres = async () => {
    try {
      setLoading(true);
      const data = await offreService.listPublished(filterDomaine !== "Tous" ? filterDomaine : undefined);
      setOffres(data);
      // Extraire domaines uniques dynamiquement depuis toutes les offres (sans filtre)
      if (filterDomaine === "Tous") {
        const unique = Array.from(new Set(data.map((o) => o.domaine).filter(Boolean)));
        setDomaines(unique);
      }
    } catch { setError("Impossible de charger les offres."); }
    finally { setLoading(false); }
  };

  const fetchCandidatures = async () => {
    try { setCandidatures(await candidatureService.mesCandidatures()); } catch { /* silencieux */ }
  };

  /* Stats rapides */
  const stats = {
    total: candidatures.length,
    actives: candidatures.filter((c) => c.statut === "SOUMISE" || c.statut === "EN_COURS_EXAMEN").length,
    acceptees: candidatures.filter((c) => c.statut === "ACCEPTEE").length,
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── En-tête ── */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Espace Candidat</p>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bonjour, {user?.prenom ?? user?.email?.split("@")[0]} 👋
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Découvrez les offres et suivez vos candidatures.</p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Candidatures totales" value={stats.total} icon={<ClipboardList className="w-5 h-5 text-blue-300" />} color="bg-blue-500/10 border-blue-500/20" />
          <StatCard label="En cours" value={stats.actives} icon={<Clock className="w-5 h-5 text-amber-300" />} color="bg-amber-500/10 border-amber-500/20" />
          <StatCard label="Acceptées" value={stats.acceptees} icon={<CheckCircle2 className="w-5 h-5 text-green-300" />} color="bg-green-500/10 border-green-500/20" />
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-black/10 dark:border-white/10 w-fit mb-7">
          {(["offres", "candidatures"] as Tab[]).map((t) => (
            <button key={t} onClick={() => switchTab(t)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${tab === t
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              {t === "offres" ? <Briefcase className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
              {t === "offres" ? `Offres (${offres.length})` : `Mes candidatures (${candidatures.length})`}
            </button>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-5 flex justify-between">
            {error}
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ════════════════════════════════════════════
            TAB : Offres
        ════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {tab === "offres" && (
            <motion.div key="offres"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            >
              {/* Filtres domaine dynamiques */}
              <div className="flex flex-wrap gap-2 mb-6">
                {["Tous", ...domaines].map((d) => (
                  <button key={d} onClick={() => setFilterDomaine(d)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${filterDomaine === d
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10"
                      }`}>
                    {d}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-gray-500 dark:text-slate-400">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  Chargement des offres…
                </div>
              ) : offres.length === 0 ? (
                <div className="text-center py-20 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                  <Briefcase className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">Aucune offre disponible.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {offres.map((offre, i) => {
                    const cand = candByOffreId.get(offre.id) ?? null;
                    const dejaPostule = cand !== null;
                    const statutCfg = cand ? STATUT_CONFIG[cand.statut] : null;

                    return (
                      <motion.div
                        key={offre.id}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        onClick={() => navigate(`/candidate/offres/${offre.id}`)}
                        className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 hover:border-blue-500/40 rounded-2xl p-5 flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer group backdrop-blur-sm"
                      >
                        {/* Header carte */}
                        <div className="flex items-center gap-2 flex-wrap mb-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/25">
                            {offre.domaine}
                          </span>
                          {dejaPostule && statutCfg && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statutCfg.cls}`}>
                              {statutCfg.icon} {statutCfg.label}
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-1">
                          {offre.titre}
                        </h3>
                        <p className="text-gray-500 dark:text-slate-400 text-sm line-clamp-3 mb-4 leading-relaxed">{offre.description}</p>

                        {/* Compétences */}
                        {offre.competences_requises.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {offre.competences_requises.slice(0, 3).map((c) => (
                              <span key={c} className="px-2 py-0.5 rounded-md text-xs bg-black/5 dark:bg-white/5 text-gray-500 dark:text-slate-500 border border-black/10 dark:border-white/10">{c}</span>
                            ))}
                            {offre.competences_requises.length > 3 && (
                              <span className="px-2 py-0.5 rounded-md text-xs bg-black/5 dark:bg-white/5 text-gray-500 dark:text-slate-500 border border-black/10 dark:border-white/10">
                                +{offre.competences_requises.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* CTA */}
                        <div className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all mt-auto ${dejaPostule
                            ? "bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 border border-black/10 dark:border-white/10 group-hover:bg-black/10 dark:group-hover:bg-white/10"
                            : "bg-blue-600 text-white group-hover:bg-blue-500 group-hover:shadow-[0_4px_20px_rgba(37,99,235,0.4)]"
                          }`}>
                          {dejaPostule ? (
                            <><FileText className="w-4 h-4" /> Voir ma candidature</>
                          ) : (
                            <>Voir et postuler <ChevronRight className="w-4 h-4" /></>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════
              TAB : Mes candidatures
          ════════════════════════════════════════════ */}
          {tab === "candidatures" && (
            <motion.div key="cands"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            >
              {candidatures.length === 0 ? (
                <div className="text-center py-20 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                  <ClipboardList className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400 mb-4">Vous n'avez pas encore postulé à une offre.</p>
                  <button onClick={() => switchTab("offres")}
                    className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-all">
                    Voir les offres
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {candidatures.map((c, i) => {
                    const cfg = STATUT_CONFIG[c.statut];
                    return (
                      <motion.div key={c.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        onClick={() => navigate(`/candidate/candidatures/${c.id}`)}
                        className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-blue-500/40 hover:bg-black/[0.03] dark:hover:bg-white/[0.07] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer group backdrop-blur-sm"
                      >
                        {/* Icône */}
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-blue-400" />
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {c.offre_titre ?? "Offre"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {c.offre_domaine && (
                              <span className="text-xs text-gray-500 dark:text-slate-500 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-full border border-black/10 dark:border-white/10">
                                {c.offre_domaine}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-500">
                              <FileText className="w-3 h-3" /> {c.cv_nom_fichier}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">
                            Soumise le {new Date(c.date_postulation).toLocaleDateString("fr-FR")}
                          </p>
                        </div>

                        {/* Statut + chevron */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}