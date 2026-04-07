/**
 * CandidateDashboard.tsx — Espace candidat
 * Fond sombre premium. Grille d'offres avec cartes glassmorphiques,
 * filtres par domaine animés, modal de candidature et suivi des candidatures.
 * Les offres avec candidature soumise restent consultables depuis l'onglet offres
 * ET depuis l'onglet candidatures (icône "œil" pour voir les détails).
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase, ClipboardList, Search, Upload, X, ChevronRight,
  Calendar, Award, CheckCircle2, Clock, XCircle, FileText, Eye,
} from "lucide-react";
import offreService from "@/services/offreService";
import candidatureService from "@/services/candidatureService";
import { useAuthStore } from "@/store/authStore";
import type { Offre, Candidature, StatutCandidature } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

/* ── Domaines disponibles ── */
const DOMAINES = ["Tous", "Informatique", "Finance", "Marketing", "RH", "Commercial", "Ingénierie", "Autre"];

/* ── Config statuts candidature ── */
const STATUT_CONFIG: Record<StatutCandidature, { label: string; icon: React.ReactNode; cls: string }> = {
  SOUMISE:         { label: "Soumise",           icon: <Clock className="w-3 h-3" />,        cls: "bg-blue-500/20 text-blue-300 border-blue-500/30"    },
  EN_COURS_EXAMEN: { label: "En cours d'examen", icon: <Search className="w-3 h-3" />,       cls: "bg-amber-500/20 text-amber-300 border-amber-500/30"  },
  ACCEPTEE:        { label: "Acceptée",           icon: <CheckCircle2 className="w-3 h-3" />, cls: "bg-green-500/20 text-green-300 border-green-500/30"  },
  REFUSEE:         { label: "Refusée",            icon: <XCircle className="w-3 h-3" />,      cls: "bg-red-500/20 text-red-300 border-red-500/30"        },
};

type Tab = "offres" | "candidatures";

/* ── Carte statistique ── */
function StatCard({ label, value, icon, color }: {
  label: string; value: number; icon: React.ReactNode; color: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 flex items-center gap-4 ${color}`}>
      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-white/60 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ── Modal détail offre ──────────────────────────────────────────────
   Affiche les détails de l'offre. Si déjà postulée, montre le statut
   de la candidature à la place du formulaire d'upload.
   Si pas encore postulée, permet d'uploader un CV et de postuler.
*/
function OffreModal({
  offre,
  candidature,
  onClose,
  onPostuler,
  postuleLoading,
  postuleError,
  postuleSuccess,
  cvFile,
  onCvChange,
}: {
  offre: Offre;
  candidature: Candidature | null;
  onClose: () => void;
  onPostuler: () => void;
  postuleLoading: boolean;
  postuleError: string | null;
  postuleSuccess: string | null;
  cvFile: File | null;
  onCvChange: (f: File | null) => void;
}) {
  const dejaPostule = candidature !== null;
  const statutCfg  = candidature ? STATUT_CONFIG[candidature.statut] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-slate-900 border border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.5)] max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* ── Header ── */}
        <div className="p-6 border-b border-white/10 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {offre.domaine}
                </span>
                {dejaPostule && statutCfg && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statutCfg.cls}`}>
                    {statutCfg.icon} {statutCfg.label}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white">{offre.titre}</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Corps scrollable ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Description du poste</p>
            <p className="text-sm text-slate-300 leading-relaxed">{offre.description}</p>
          </div>

          {/* Méta */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            {offre.annees_experience_min > 0 && (
              <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                <Award className="w-3.5 h-3.5 text-blue-400" />
                {offre.annees_experience_min} an{offre.annees_experience_min > 1 ? "s" : ""} d'expérience min.
              </span>
            )}
            {offre.date_debut_souhaitee && (
              <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Début : {new Date(offre.date_debut_souhaitee).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>

          {/* Compétences requises */}
          {offre.competences_requises.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Compétences requises</p>
              <div className="flex flex-wrap gap-1.5">
                {offre.competences_requises.map((c) => (
                  <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/25">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Section selon statut ── */}
          <div className="border-t border-white/10 pt-5">
            {dejaPostule && candidature ? (
              /* Déjà postulé — afficher les infos de candidature */
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Ma candidature</p>

                <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-blue-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">CV soumis</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{candidature.cv_nom_fichier}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Soumise le {new Date(candidature.date_postulation).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  {statutCfg && (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shrink-0 ${statutCfg.cls}`}>
                      {statutCfg.icon} {statutCfg.label}
                    </span>
                  )}
                </div>

                {/* Message contextuel selon le statut */}
                {candidature.statut === "ACCEPTEE" && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-sm text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Félicitations ! Votre candidature a été acceptée.
                  </div>
                )}
                {candidature.statut === "REFUSEE" && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300 flex items-center gap-2">
                    <XCircle className="w-4 h-4 shrink-0" />
                    Votre candidature n'a pas été retenue.
                  </div>
                )}
                {(candidature.statut === "SOUMISE" || candidature.statut === "EN_COURS_EXAMEN") && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    Votre candidature est en cours d'examen.
                  </div>
                )}
              </div>
            ) : (
              /* Pas encore postulé — formulaire d'upload */
              <div className="space-y-3">
                <p className="text-sm font-medium text-white">
                  Téléversez votre CV{" "}
                  <span className="text-slate-500 font-normal">(PDF, DOCX, DOC — 5 Mo max)</span>
                </p>
                <label className={`block w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
                  cvFile
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5"
                }`}>
                  <input type="file" accept=".pdf,.docx,.doc" className="hidden"
                    onChange={(e) => onCvChange(e.target.files?.[0] ?? null)} />
                  {cvFile ? (
                    <div className="text-green-400">
                      <CheckCircle2 className="w-7 h-7 mx-auto mb-2" />
                      <p className="font-semibold text-sm">{cvFile.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{(cvFile.size / 1024 / 1024).toFixed(2)} Mo</p>
                    </div>
                  ) : (
                    <div className="text-slate-500">
                      <Upload className="w-7 h-7 mx-auto mb-2 text-slate-600" />
                      <p className="text-sm">Cliquez pour sélectionner votre CV</p>
                    </div>
                  )}
                </label>

                {postuleError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3">
                    {postuleError}
                  </div>
                )}
                {postuleSuccess && (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-300 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> {postuleSuccess}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="p-5 border-t border-white/10 shrink-0 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 transition-colors">
            Fermer
          </button>
          {!dejaPostule && (
            <button
              onClick={onPostuler}
              disabled={!cvFile || postuleLoading || !!postuleSuccess}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-all shadow-md hover:shadow-[0_4px_20px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {postuleLoading ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Envoi…</>
              ) : "Soumettre ma candidature"}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Composant principal ── */
export default function CandidateDashboard() {
  const { user } = useAuthStore();
  const [tab,            setTab]            = useState<Tab>("offres");
  const [offres,         setOffres]         = useState<Offre[]>([]);
  const [candidatures,   setCandidatures]   = useState<Candidature[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [filterDomaine,  setFilterDomaine]  = useState("Tous");

  /* Modal */
  const [selectedOffre,  setSelectedOffre]  = useState<Offre | null>(null);
  const [postuleLoading, setPostuleLoading] = useState(false);
  const [postuleError,   setPostuleError]   = useState<string | null>(null);
  const [postuleSuccess, setPostuleSuccess] = useState<string | null>(null);
  const [cvFile,         setCvFile]         = useState<File | null>(null);

  /* Map offre_id -> Candidature pour lookup rapide */
  const candByOffreId = new Map(candidatures.map((c) => [c.offre_id, c]));

  useEffect(() => { fetchOffres(); fetchCandidatures(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchOffres(); }, [filterDomaine]);

  const fetchOffres = async () => {
    try {
      setLoading(true);
      setOffres(await offreService.listPublished(filterDomaine !== "Tous" ? filterDomaine : undefined));
    } catch { setError("Impossible de charger les offres."); }
    finally   { setLoading(false); }
  };

  const fetchCandidatures = async () => {
    try { setCandidatures(await candidatureService.mesCandidatures()); } catch { /* silencieux */ }
  };

  /* Ouvrir la modal pour une offre donnée (qu'elle soit déjà postulée ou non) */
  const openOffre = (offre: Offre) => {
    setSelectedOffre(offre);
    setPostuleError(null);
    setPostuleSuccess(null);
    setCvFile(null);
  };

  /* Ouvrir la modal depuis l'onglet "Mes candidatures" */
  const openFromCandidature = async (cand: Candidature) => {
    // On cherche l'offre dans la liste déjà chargée
    let offre = offres.find((o) => o.id === cand.offre_id) ?? null;
    // Si pas trouvée (ex: offre fermée), on tente de la charger
    if (!offre) {
      try {
        offre = await offreService.getById(cand.offre_id);
        if (!offre) return;
        // On l'ajoute temporairement à la liste locale pour éviter un rechargement
        setOffres((prev) => [offre as Offre, ...prev.filter((o) => o.id !== cand.offre_id)]);
      } catch { return; }
    }
    openOffre(offre);
  };

  const handlePostuler = async () => {
    if (!selectedOffre || !cvFile) return;
    setPostuleLoading(true);
    setPostuleError(null);
    setPostuleSuccess(null);
    try {
      await candidatureService.postuler(selectedOffre.id, cvFile);
      setPostuleSuccess("Candidature soumise avec succès !");
      await fetchCandidatures();
      setCvFile(null);
    } catch (err: unknown) {
      setPostuleError(
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Erreur lors de la soumission.",
      );
    } finally { setPostuleLoading(false); }
  };

  /* Stats rapides */
  const stats = {
    total:     candidatures.length,
    actives:   candidatures.filter((c) => c.statut === "SOUMISE" || c.statut === "EN_COURS_EXAMEN").length,
    acceptees: candidatures.filter((c) => c.statut === "ACCEPTEE").length,
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── En-tête ── */}
        <div className="mb-8">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-1">Espace Candidat</p>
          <h1 className="text-3xl font-bold text-white">
            Bonjour, {user?.prenom ?? user?.email?.split("@")[0]} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">Découvrez les offres et suivez vos candidatures.</p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Candidatures totales" value={stats.total}     icon={<ClipboardList className="w-5 h-5 text-blue-300" />}  color="bg-blue-500/10 border-blue-500/20"   />
          <StatCard label="En cours"             value={stats.actives}   icon={<Clock         className="w-5 h-5 text-amber-300" />}  color="bg-amber-500/10 border-amber-500/20" />
          <StatCard label="Acceptées"            value={stats.acceptees} icon={<CheckCircle2  className="w-5 h-5 text-green-300" />}  color="bg-green-500/10 border-green-500/20" />
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 border border-white/10 w-fit mb-7">
          {(["offres", "candidatures"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                tab === t
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {t === "offres" ? <Briefcase className="w-4 h-4" /> : <ClipboardList className="w-4 h-4" />}
              {t === "offres" ? `Offres (${offres.length})` : `Mes candidatures (${candidatures.length})`}
            </button>
          ))}
        </div>

        {/* Erreur globale */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-5 flex justify-between">
            {error}
            <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ── TAB : Offres ── */}
        <AnimatePresence mode="wait">
          {tab === "offres" && (
            <motion.div key="offres"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            >
              {/* Filtres domaine */}
              <div className="flex flex-wrap gap-2 mb-6">
                {DOMAINES.map((d) => (
                  <button key={d} onClick={() => setFilterDomaine(d)}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                      filterDomaine === d
                        ? "bg-blue-600 text-white border-blue-600 shadow-md"
                        : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}>
                    {d}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-slate-400">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  Chargement des offres...
                </div>
              ) : offres.length === 0 ? (
                <div className="text-center py-20">
                  <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">Aucune offre disponible pour ce domaine.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {offres.map((offre, i) => {
                    const dejaPostule = candByOffreId.has(offre.id);
                    const cand = candByOffreId.get(offre.id);
                    const statutCfg = cand ? STATUT_CONFIG[cand.statut] : null;

                    return (
                      <motion.div
                        key={offre.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.05 }}
                        className="group bg-white/5 hover:bg-white/8 border border-white/10 hover:border-blue-500/40 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(37,99,235,0.1)] flex flex-col"
                      >
                        {/* Header carte */}
                        <div className="flex items-start justify-between mb-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            {offre.domaine}
                          </span>
                          {dejaPostule && statutCfg && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${statutCfg.cls}`}>
                              {statutCfg.icon} {statutCfg.label}
                            </span>
                          )}
                        </div>

                        {/* Titre & Description */}
                        <h3 className="font-bold text-white text-base mb-2 line-clamp-2 group-hover:text-blue-200 transition-colors">
                          {offre.titre}
                        </h3>
                        <p className="text-slate-400 text-sm line-clamp-3 mb-4 leading-relaxed flex-1">{offre.description}</p>

                        {/* Méta */}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-4">
                          {offre.annees_experience_min > 0 && (
                            <span className="flex items-center gap-1">
                              <Award className="w-3.5 h-3.5" />
                              {offre.annees_experience_min} an{offre.annees_experience_min > 1 ? "s" : ""} exp.
                            </span>
                          )}
                          {offre.date_debut_souhaitee && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(offre.date_debut_souhaitee).toLocaleDateString("fr-FR")}
                            </span>
                          )}
                        </div>

                        {/* Compétences */}
                        {offre.competences_requises.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {offre.competences_requises.slice(0, 3).map((c) => (
                              <span key={c} className="px-2 py-0.5 rounded-md text-xs bg-white/5 text-slate-400 border border-white/10">
                                {c}
                              </span>
                            ))}
                            {offre.competences_requises.length > 3 && (
                              <span className="px-2 py-0.5 rounded-md text-xs bg-white/5 text-slate-500 border border-white/10">
                                +{offre.competences_requises.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {/* CTA — toujours cliquable pour voir les détails */}
                        <button
                          onClick={() => openOffre(offre)}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-xl transition-all active:scale-[0.98] ${
                            dejaPostule
                              ? "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:border-white/20"
                              : "bg-blue-600 text-white hover:bg-blue-500 hover:shadow-[0_4px_20px_rgba(37,99,235,0.4)]"
                          }`}
                        >
                          {dejaPostule ? (
                            <><Eye className="w-4 h-4" /> Voir ma candidature</>
                          ) : (
                            <>Voir et postuler <ChevronRight className="w-4 h-4" /></>
                          )}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ── TAB : Candidatures ── */}
          {tab === "candidatures" && (
            <motion.div key="cands"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            >
              {candidatures.length === 0 ? (
                <div className="text-center py-20 bg-white/5 rounded-2xl border border-white/10">
                  <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 mb-4">Vous n'avez pas encore postulé à une offre.</p>
                  <button onClick={() => setTab("offres")}
                    className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-all">
                    Voir les offres
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {candidatures.map((c, i) => {
                    const cfg = STATUT_CONFIG[c.statut];
                    return (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.04 }}
                        className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4 hover:border-white/20 hover:bg-white/7 transition-all duration-200 group"
                      >
                        {/* Icône offre */}
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                          <Briefcase className="w-5 h-5 text-blue-300" />
                        </div>

                        {/* Infos */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{c.offre_titre ?? "Offre"}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {c.offre_domaine && (
                              <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                                {c.offre_domaine}
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <FileText className="w-3 h-3" /> {c.cv_nom_fichier}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Soumise le {new Date(c.date_postulation).toLocaleDateString("fr-FR")}
                          </p>
                        </div>

                        {/* Statut + bouton voir */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {/* Bouton "Voir le détail" — visible au hover */}
                          <button
                            onClick={() => openFromCandidature(c)}
                            title="Voir le détail de l'offre"
                            className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 flex items-center justify-center text-slate-400 hover:text-blue-300 transition-all"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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

      {/* ── Modal Offre / Candidature ── */}
      <AnimatePresence>
        {selectedOffre && (
          <OffreModal
            offre={selectedOffre}
            candidature={candByOffreId.get(selectedOffre.id) ?? null}
            onClose={() => setSelectedOffre(null)}
            onPostuler={handlePostuler}
            postuleLoading={postuleLoading}
            postuleError={postuleError}
            postuleSuccess={postuleSuccess}
            cvFile={cvFile}
            onCvChange={setCvFile}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}