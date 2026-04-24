/**
 * CandidatureCandidatPage.tsx
 * Route : /candidate/candidatures/:id
 *
 * Page dédiée au suivi d'une candidature côté candidat.
 * Affiche : offre concernée, statut, CV soumis, score matching si disponible.
 */
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, ChevronRight, Clock, CheckCircle2, XCircle,
    FileText, AlertCircle, Search, Zap, Briefcase,
} from "lucide-react";
import candidatureService from "@/services/candidatureService";
import matchingService from "@/services/matchingService";
import type { Candidature, StatutCandidature } from "@/types";
import MatchScoreCard, { type MatchResult } from "@/components/matching/MatchScoreCard";
import DashboardLayout from "@/components/layout/DashboardLayout";

const STATUT_CONFIG: Record<StatutCandidature, { label: string; icon: React.ReactNode; cls: string; bar: string }> = {
    SOUMISE: { label: "Soumise", icon: <Clock className="w-4 h-4" />, cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30", bar: "bg-blue-500" },
    EN_COURS_EXAMEN: { label: "En cours d'examen", icon: <Search className="w-4 h-4" />, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30", bar: "bg-amber-500" },
    ACCEPTEE: { label: "Acceptée", icon: <CheckCircle2 className="w-4 h-4" />, cls: "bg-green-500/15 text-green-600 dark:text-green-300 border-green-500/30", bar: "bg-green-500" },
    REFUSEE: { label: "Refusée", icon: <XCircle className="w-4 h-4" />, cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30", bar: "bg-red-500" },
};

const isPending = (c: Candidature) =>
    c.parse_statut === "EN_ATTENTE" || c.parse_statut === "EN_COURS";

export default function CandidatureCandidatPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [cand, setCand] = useState<Candidature | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
    const [matchLoading, setMatchLoading] = useState(false);

    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                setLoading(true);
                // On charge toutes les candidatures du candidat et on filtre par id
                // (getCandidature est un endpoint recruteur uniquement)
                const all = await candidatureService.mesCandidatures();
                const found = all.find((c) => c.id === id) ?? null;
                if (!found) throw new Error("Not found");
                setCand(found);
            } catch {
                setError("Impossible de charger cette candidature.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    /* Polling si parsing en cours */
    useEffect(() => {
        if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
        if (!cand || !isPending(cand)) return;
        pollingRef.current = setInterval(async () => {
            try {
                const all = await candidatureService.mesCandidatures();
                const fresh = all.find((c) => c.id === cand.id) ?? null;
                if (!fresh) return;
                setCand(fresh);
                if (!isPending(fresh)) { clearInterval(pollingRef.current!); pollingRef.current = null; }
            } catch { /* silencieux */ }
        }, 3000);
        return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
    }, [cand?.id, cand?.parse_statut]);

    /* Fetch match score quand parsing terminé */
    useEffect(() => {
        if (!cand || cand.parse_statut !== "TERMINE") return;
        const fetchMatch = async () => {
            setMatchLoading(true);
            try {
                const r = await matchingService.getMatchResult(cand.id);
                setMatchResult(r);
            } catch { /* silencieux */ }
            finally { setMatchLoading(false); }
        };
        fetchMatch();
    }, [cand?.id, cand?.parse_statut]);

    useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
                        <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                        Chargement de votre candidature…
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !cand) {
        return (
            <DashboardLayout>
                <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-slate-400">{error ?? "Candidature introuvable."}</p>
                    <button onClick={() => navigate("/candidate/dashboard?tab=candidatures")}
                        className="mt-6 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-all">
                        Mes candidatures
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    const statutCfg = STATUT_CONFIG[cand.statut];

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ── Breadcrumb ── */}
                <motion.nav
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-500 mb-6"
                >
                    <button
                        onClick={() => navigate("/candidate/dashboard?tab=candidatures")}
                        className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Mes candidatures
                    </button>
                    <ChevronRight className="w-4 h-4" />
                    {cand.offre_titre && (
                        <>
                            <button
                                onClick={() => navigate(`/candidate/offres/${cand.offre_id}`)}
                                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[160px]"
                            >
                                {cand.offre_titre}
                            </button>
                            <ChevronRight className="w-4 h-4" />
                        </>
                    )}
                    <span className="text-gray-900 dark:text-white font-medium">Ma candidature</span>
                </motion.nav>

                {/* ── Hero card statut ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden mb-6"
                >
                    <div className={`h-1 w-full ${statutCfg.bar}`} />
                    <div className="p-6">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Candidature pour</p>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                    {cand.offre_titre ?? "Offre"}
                                </h1>
                                {cand.offre_domaine && (
                                    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/25">
                                        {cand.offre_domaine}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${statutCfg.cls}`}>
                                    {statutCfg.icon} {statutCfg.label}
                                </span>
                                {(cand.parse_statut === "EN_ATTENTE" || cand.parse_statut === "EN_COURS") && (
                                    <span className="inline-flex items-center gap-1.5 text-xs text-blue-500 dark:text-blue-400">
                                        <div className="w-3 h-3 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                                        Analyse IA en cours…
                                    </span>
                                )}
                                {cand.parse_statut === "TERMINE" && matchResult && (
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${matchResult.niveau === "EXCELLENT" ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30" :
                                            matchResult.niveau === "BON" ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" :
                                                matchResult.niveau === "PARTIEL" ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" :
                                                    "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30"
                                        }`}>
                                        <Zap className="w-3.5 h-3.5" /> Score : {matchResult.score_total}%
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ── CV soumis ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-2xl p-5 mb-5"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">CV soumis</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{cand.cv_nom_fichier}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-xs text-gray-500 dark:text-slate-500">Soumis le</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {new Date(cand.date_postulation).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* ── Message contextuel statut ── */}
                <AnimatePresence>
                    {cand.statut === "ACCEPTEE" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 mb-5 flex items-center gap-3 text-green-600 dark:text-green-300">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-semibold">Candidature acceptée !</p>
                                <p className="text-sm mt-0.5 opacity-80">Félicitations, le recruteur a retenu votre profil.</p>
                            </div>
                        </motion.div>
                    )}
                    {cand.statut === "REFUSEE" && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-5 flex items-center gap-3 text-red-600 dark:text-red-300">
                            <XCircle className="w-5 h-5 shrink-0" />
                            <div>
                                <p className="font-semibold">Candidature non retenue</p>
                                <p className="text-sm mt-0.5 opacity-80">Ne vous découragez pas, d'autres opportunités vous attendent.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Score de matching ── */}
                {(cand.parse_statut === "TERMINE" || matchLoading) && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                    >
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-3">Score de matching</p>
                        <MatchScoreCard match={matchResult} loading={matchLoading} />
                    </motion.div>
                )}

                {/* ── Lien vers l'offre ── */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="mt-6"
                >
                    <button
                        onClick={() => navigate(`/candidate/offres/${cand.offre_id}`)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-all"
                    >
                        <Briefcase className="w-4 h-4" />
                        Voir l'offre associée
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </motion.div>
            </div>
        </DashboardLayout>
    );
}