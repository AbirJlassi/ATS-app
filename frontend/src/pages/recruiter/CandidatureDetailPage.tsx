import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, AlertCircle, Loader2, CheckCircle2, XCircle,
  Clock, Eye, Zap, Star, ChevronDown, RefreshCw, Download,
} from "lucide-react";
import candidatureService from "@/services/candidatureService";
import matchingService from "@/services/matchingService";
import type { Candidature, StatutCandidature } from "@/types";
import type { MatchResult } from "@/components/matching/MatchScoreCard";
import CVProfileCard from "@/components/candidature/CVProfileCard";
import MatchScoreCard from "@/components/matching/MatchScoreCard";
import DashboardLayout from "@/components/layout/DashboardLayout";

/* ── Constants ── */
const STATUT_CAND: Record<StatutCandidature, { label: string; cls: string; icon: React.ReactNode }> = {
  SOUMISE: { label: "Soumise", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30", icon: <Clock className="w-3.5 h-3.5" /> },
  EN_COURS_EXAMEN: { label: "En cours", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: <Eye className="w-3.5 h-3.5" /> },
  ACCEPTEE: { label: "Acceptée", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  REFUSEE: { label: "Refusée", cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30", icon: <XCircle className="w-3.5 h-3.5" /> },
};

const NIVEAU_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  EXCELLENT: { label: "Excellent", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
  BON: { label: "Bon", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
  PARTIEL: { label: "Partiel", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25" },
  FAIBLE: { label: "Faible", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/25" },
};

const isPending = (c: Candidature) =>
  c.parse_statut === "EN_ATTENTE" || c.parse_statut === "EN_COURS";

type DetailTab = "cv" | "match";

export default function CandidatureDetailPage() {
  const { id: candidatureId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cand, setCand] = useState<Candidature | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<DetailTab>("cv");
  const [statusLoading, setStatusLoading] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Fetch candidature ── */
  useEffect(() => {
    if (!candidatureId) return;
    (async () => {
      setLoading(true);
      try {
        const c = await candidatureService.getCandidature(candidatureId);
        setCand(c);
      } catch {
        setError("Impossible de charger cette candidature.");
      } finally {
        setLoading(false);
      }
    })();
  }, [candidatureId]);

  /* ── Fetch match result quand parsing terminé ── */
  useEffect(() => {
    if (!cand || cand.parse_statut !== "TERMINE") { setMatchResult(null); return; }
    setMatchLoading(true);
    matchingService.getMatchResult(cand.id)
      .then(setMatchResult)
      .catch(() => {/* silencieux */ })
      .finally(() => setMatchLoading(false));
  }, [cand?.id, cand?.parse_statut]);

  /* ── Polling si parsing en cours ── */
  useEffect(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (!cand || !isPending(cand)) return;
    pollingRef.current = setInterval(async () => {
      try {
        const fresh = await candidatureService.getCandidature(cand.id);
        setCand(fresh);
        if (!isPending(fresh)) { clearInterval(pollingRef.current!); pollingRef.current = null; }
      } catch { /* silencieux */ }
    }, 3000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [cand?.id, cand?.parse_statut]);

  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  /* ── Actions ── */
  const handleStatut = async (statut: StatutCandidature) => {
    if (!cand) return;
    setStatusLoading(true);
    try {
      const u = await candidatureService.updateStatut(cand.id, statut);
      setCand(u);
    } catch { setError("Impossible de mettre à jour le statut."); }
    finally { setStatusLoading(false); }
  };

  const handleAccept = async () => { await handleStatut("ACCEPTEE"); };
  const handleReject = async () => { await handleStatut("REFUSEE"); };

  const backUrl = cand?.offre_id
    ? `/recruiter/dashboard?tab=candidatures&offreId=${cand.offre_id}`
    : `/recruiter/dashboard?tab=candidatures`;

  /* ── Loading state ── */
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !cand) {
    return (
      <DashboardLayout>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-slate-400">{error}</p>
          <button onClick={() => navigate(backUrl)}
            className="mt-6 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-500 transition-all">
            ← Retour
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const niveau = matchResult?.niveau ? NIVEAU_CONFIG[matchResult.niveau] : null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Breadcrumb ── */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-8">
          <Link
            to={backUrl}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Candidatures
          </Link>
          {cand?.offre_titre && cand?.offre_id && (
            <>
              <span className="text-gray-400 dark:text-slate-600">/</span>
              <Link
                to={`/recruiter/dashboard?tab=candidatures&offreId=${cand.offre_id}`}
                className="text-sm text-gray-500 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[160px] transition-colors"
              >
                {cand.offre_titre}
              </Link>
            </>
          )}
          <span className="text-gray-400 dark:text-slate-600">/</span>
          <span className="text-sm text-gray-900 dark:text-white font-medium">
            {cand?.candidat_prenom} {cand?.candidat_nom}
          </span>
        </motion.div>

        {/* ── Hero candidate card ── */}
        {cand && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                {/* Big avatar */}
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/30 to-violet-500/30 border border-black/10 dark:border-white/10 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xl shrink-0">
                  {cand.candidat_prenom?.[0]?.toUpperCase() ?? cand.candidat_email?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {cand.candidat_prenom} {cand.candidat_nom}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-slate-400">{cand.candidat_email}</p>
                  {cand.offre_titre && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                      Candidature pour <span className="text-gray-600 dark:text-slate-300 font-medium">{cand.offre_titre}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Status + Match score pill */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Match niveau badge */}
                {niveau && matchResult && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${niveau.bg} ${niveau.border}`}>
                    <Star className={`w-3.5 h-3.5 ${niveau.color}`} />
                    <span className={`text-sm font-bold ${niveau.color}`}>{matchResult.score_total}%</span>
                    <span className={`text-xs ${niveau.color} opacity-70`}>{niveau.label}</span>
                  </div>
                )}
                {/* Parsing indicator */}
                {isPending(cand) && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 dark:border-blue-400 border-t-transparent animate-spin" />
                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Analyse IA en cours…</span>
                  </div>
                )}
                {/* Current statut */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border ${STATUT_CAND[cand.statut].cls}`}>
                  {STATUT_CAND[cand.statut].icon}
                  {STATUT_CAND[cand.statut].label}
                </span>
              </div>
            </div>

            {/* ── Quick actions bar ── */}
            <div className="flex items-center gap-3 mt-5 pt-5 border-t border-black/10 dark:border-white/10 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide">Changer le statut :</span>
              <div className="flex items-center gap-2 flex-1 flex-wrap">
                <div className="relative">
                  <select
                    className="appearance-none pl-3 pr-8 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer transition-all dark:[color-scheme:dark]"
                    value={cand.statut}
                    onChange={(e) => handleStatut(e.target.value as StatutCandidature)}
                    disabled={statusLoading}
                  >
                    <option value="SOUMISE">Soumise</option>
                    <option value="EN_COURS_EXAMEN">En cours d'examen</option>
                    <option value="ACCEPTEE">Acceptée ✓</option>
                    <option value="REFUSEE">Refusée ✕</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={handleReject}
                  disabled={statusLoading || cand.statut === "REFUSEE"}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {statusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Refuser
                </button>
                <button
                  onClick={handleAccept}
                  disabled={statusLoading || cand.statut === "ACCEPTEE"}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {statusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Accepter
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Tab navigation ── */}
        {cand && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-black/10 dark:border-white/10 w-fit mb-6">
              <button
                onClick={() => setActiveTab("cv")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${activeTab === "cv"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
              >
                <Download className="w-4 h-4" />
                Profil &amp; CV
              </button>

              <button
                onClick={() => setActiveTab("match")}
                disabled={!matchResult && !matchLoading && cand.parse_statut !== "TERMINE"}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${activeTab === "match"
                  ? "bg-amber-500 text-white shadow-md"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
              >
                {matchLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Calcul du score…
                  </>
                ) : matchResult ? (
                  <>
                    <Zap className="w-4 h-4" />
                    Matching — {matchResult.score_total}%
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Score de matching
                  </>
                )}
              </button>
            </div>

            {/* ── Tab content ── */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 backdrop-blur-sm"
            >
              {activeTab === "cv" && (
                <CVProfileCard
                  cvData={cand.cv_data}
                  parseStatut={cand.parse_statut}
                  cvNomFichier={cand.cv_nom_fichier}
                  candidatureId={cand.id}
                  candidatNom={cand.candidat_nom ?? undefined}
                  candidatPrenom={cand.candidat_prenom ?? undefined}
                  candidatEmail={cand.candidat_email ?? undefined}
                />
              )}

              {activeTab === "match" && (
                <MatchScoreCard match={matchResult} loading={matchLoading} />
              )}
            </motion.div>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}