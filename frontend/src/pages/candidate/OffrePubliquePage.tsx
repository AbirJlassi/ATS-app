/**
 * OffrePubliquePage.tsx
 * Route : /candidate/offres/:id
 *
 * Page dédiée à la visualisation complète d'une offre publique.
 * Permet de postuler si pas encore candidaté, ou affiche la candidature existante.
 */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft, ChevronRight, Award, Calendar, Clock, CheckCircle2,
    XCircle, Upload, FileText, AlertCircle, Loader2, Search,
} from "lucide-react";
import offreService from "@/services/offreService";
import candidatureService from "@/services/candidatureService";
import type { Offre, Candidature, StatutCandidature } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

const STATUT_CONFIG: Record<StatutCandidature, { label: string; icon: React.ReactNode; cls: string; bar: string }> = {
    SOUMISE: { label: "Soumise", icon: <Clock className="w-4 h-4" />, cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30", bar: "bg-blue-500" },
    EN_COURS_EXAMEN: { label: "En cours d'examen", icon: <Search className="w-4 h-4" />, cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30", bar: "bg-amber-500" },
    ACCEPTEE: { label: "Acceptée", icon: <CheckCircle2 className="w-4 h-4" />, cls: "bg-green-500/15 text-green-600 dark:text-green-300 border-green-500/30", bar: "bg-green-500" },
    REFUSEE: { label: "Refusée", icon: <XCircle className="w-4 h-4" />, cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30", bar: "bg-red-500" },
};

export default function OffrePubliquePage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [offre, setOffre] = useState<Offre | null>(null);
    const [candidature, setCandidature] = useState<Candidature | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /* Postuler */
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [postuleLoading, setPostuleLoading] = useState(false);
    const [postuleError, setPostuleError] = useState<string | null>(null);
    const [postuleSuccess, setPostuleSuccess] = useState(false);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                setLoading(true);
                const [o, mesCands] = await Promise.all([
                    offreService.getById(id),
                    candidatureService.mesCandidatures(),
                ]);
                setOffre(o);
                const existing = mesCands.find((c) => c.offre_id === id) ?? null;
                setCandidature(existing);
            } catch {
                setError("Impossible de charger cette offre.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const handlePostuler = async () => {
        if (!offre || !cvFile) return;
        setPostuleLoading(true);
        setPostuleError(null);
        try {
            const cand = await candidatureService.postuler(offre.id, cvFile);
            setCandidature(cand);
            setPostuleSuccess(true);
            setCvFile(null);
        } catch (err: unknown) {
            setPostuleError(
                (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                "Erreur lors de la soumission."
            );
        } finally { setPostuleLoading(false); }
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="flex items-center gap-3 text-gray-500 dark:text-slate-400">
                        <div className="w-6 h-6 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                        Chargement de l'offre…
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (error || !offre) {
        return (
            <DashboardLayout>
                <div className="max-w-3xl mx-auto px-4 py-16 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-slate-400">{error ?? "Offre introuvable."}</p>
                    <button onClick={() => navigate("/candidate/dashboard?tab=offres")}
                        className="mt-6 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-all">
                        Retour aux offres
                    </button>
                </div>
            </DashboardLayout>
        );
    }

    const dejaPostule = candidature !== null;
    const statutCfg = candidature ? STATUT_CONFIG[candidature.statut] : null;

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* ── Breadcrumb ── */}
                <motion.nav
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-500 mb-6"
                >
                    <button
                        onClick={() => navigate("/candidate/dashboard?tab=offres")}
                        className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Offres disponibles
                    </button>
                    <ChevronRight className="w-4 h-4" />
                    <span className="text-gray-900 dark:text-white font-medium truncate max-w-xs">{offre.titre}</span>
                </motion.nav>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── Colonne principale ── */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* Card offre */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden"
                        >
                            <div className="h-1 w-full bg-blue-500" />
                            <div className="p-6">
                                <div className="flex items-center gap-2 flex-wrap mb-3">
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/25">
                                        {offre.domaine}
                                    </span>
                                    {dejaPostule && statutCfg && (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statutCfg.cls}`}>
                                            {statutCfg.icon} {statutCfg.label}
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{offre.titre}</h1>

                                <div className="mb-5">
                                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-2">Description du poste</p>
                                    <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{offre.description}</p>
                                </div>

                                {offre.competences_requises.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-2">Compétences requises</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {offre.competences_requises.map((c) => (
                                                <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">{c}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* ── Colonne droite : infos + candidature si déjà postulé ── */}
                    <div className="space-y-4">
                        {/* Infos rapides */}
                        <motion.div
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                            className="bg-white dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-2xl p-5 space-y-4"
                        >
                            <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide">Informations</p>

                            {offre.annees_experience_min > 0 && (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                        <Award className="w-4 h-4 text-blue-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-slate-500">Expérience min.</p>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {offre.annees_experience_min} an{offre.annees_experience_min > 1 ? "s" : ""}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {offre.date_debut_souhaitee && (
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                        <Calendar className="w-4 h-4 text-violet-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-slate-500">Début souhaité</p>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {new Date(offre.date_debut_souhaitee).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {(offre.recruteur_prenom || offre.recruteur_nom) && (
                                <div className="pt-3 border-t border-black/5 dark:border-white/5">
                                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-1">Publié par</p>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {offre.recruteur_prenom} {offre.recruteur_nom}
                                    </p>
                                </div>
                            )}
                        </motion.div>

                        {/* Box candidature — visible uniquement si déjà postulé */}
                        {dejaPostule && candidature && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                className="bg-white dark:bg-white/[0.03] border border-black/10 dark:border-white/10 rounded-2xl p-5 space-y-4"
                            >
                                <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide">Ma candidature</p>

                                {/* CV soumis */}
                                <div className="bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 p-4">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                                            <FileText className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900 dark:text-white">CV soumis</p>
                                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{candidature.cv_nom_fichier}</p>
                                            <p className="text-xs text-gray-400 dark:text-slate-600 mt-0.5">
                                                {new Date(candidature.date_postulation).toLocaleDateString("fr-FR")}
                                            </p>
                                        </div>
                                    </div>
                                    {statutCfg && (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border w-full justify-center ${statutCfg.cls}`}>
                                            {statutCfg.icon} {statutCfg.label}
                                        </span>
                                    )}
                                </div>

                                {/* Message contextuel */}
                                {candidature.statut === "ACCEPTEE" && (
                                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-600 dark:text-green-300 flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        Félicitations ! Votre candidature a été acceptée.
                                    </div>
                                )}
                                {candidature.statut === "REFUSEE" && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-600 dark:text-red-300 flex items-center gap-2">
                                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                                        Votre candidature n'a pas été retenue.
                                    </div>
                                )}
                                {(candidature.statut === "SOUMISE" || candidature.statut === "EN_COURS_EXAMEN") && (
                                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-600 dark:text-blue-300 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 shrink-0" />
                                        Votre candidature est en cours d'examen.
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* ── Formulaire postuler (colonne droite, si pas encore candidaté) ── */}
                        {!dejaPostule && (
                            <motion.div
                                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                                className="rounded-2xl overflow-hidden border border-blue-500/30 shadow-[0_0_30px_rgba(59,130,246,0.12)]"
                            >
                                {/* Header accentué */}
                                <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-5 pt-5 pb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Upload className="w-4 h-4 text-blue-200" />
                                        <p className="text-xs font-bold text-blue-100 uppercase tracking-widest">Postuler à cette offre</p>
                                    </div>
                                    <p className="text-white font-semibold text-sm leading-snug">{offre.titre}</p>
                                </div>

                                <div className="bg-white dark:bg-[#0f1729] p-5 space-y-4">
                                    {postuleSuccess ? (
                                        <div className="text-center py-6">
                                            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                            <p className="font-semibold text-gray-900 dark:text-white mb-1">Candidature soumise !</p>
                                            <p className="text-sm text-gray-500 dark:text-slate-400">Votre CV est en cours d'analyse.</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-gray-600 dark:text-slate-400">
                                                Téléversez votre CV <span className="text-gray-400 dark:text-slate-500 text-xs">(PDF, DOCX — 5 Mo max)</span>
                                            </p>

                                            <label className={`block w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${cvFile
                                                ? "border-green-500/50 bg-green-500/8"
                                                : "border-blue-500/20 bg-blue-500/5 hover:border-blue-500/50 hover:bg-blue-500/10"
                                                }`}>
                                                <input type="file" accept=".pdf,.docx,.doc" className="hidden"
                                                    onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} />
                                                {cvFile ? (
                                                    <div className="text-green-500">
                                                        <CheckCircle2 className="w-7 h-7 mx-auto mb-2" />
                                                        <p className="font-semibold text-sm truncate">{cvFile.name}</p>
                                                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">{(cvFile.size / 1024 / 1024).toFixed(2)} Mo</p>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Upload className="w-7 h-7 mx-auto mb-2 text-blue-400" />
                                                        <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Sélectionner votre CV</p>
                                                        <p className="text-xs mt-1 text-gray-400 dark:text-slate-600">ou glissez-déposez ici</p>
                                                    </div>
                                                )}
                                            </label>

                                            <AnimatePresence>
                                                {postuleError && (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                                        className="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs rounded-xl px-3 py-2.5 flex items-center gap-2">
                                                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {postuleError}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <button
                                                onClick={handlePostuler}
                                                disabled={!cvFile || postuleLoading}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                                            >
                                                {postuleLoading
                                                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
                                                    : "Soumettre ma candidature →"
                                                }
                                            </button>
                                        </>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}