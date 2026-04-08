/**
 * MatchScoreCard — Affiche le score de matching IA d'une candidature.
 * Utilisé dans la modal fiche candidat (RecruiterDashboard).
 */
interface SkillsDetail { matchees: string[]; manquantes: string[]; }

export interface MatchResult {
    score_total: number;
    niveau: string;
    score_skills: number;
    score_experience: number;
    score_semantique: number;
    score_formation: number;
    skills_detail?: SkillsDetail;
    points_forts?: string;
    points_faibles?: string;
    recommandation?: string;
}

interface Props { match: MatchResult | null | undefined; loading?: boolean; }

const NIVEAU_CONFIG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
    EXCELLENT: { label: "Excellent", color: "text-green-300", bg: "bg-green-500/10 border-green-500/20", bar: "bg-green-500" },
    BON: { label: "Bon match", color: "text-blue-300", bg: "bg-blue-500/10 border-blue-500/20", bar: "bg-blue-500" },
    PARTIEL: { label: "Match partiel", color: "text-amber-300", bg: "bg-amber-500/10 border-amber-500/20", bar: "bg-amber-500" },
    FAIBLE: { label: "Faible match", color: "text-red-300", bg: "bg-red-500/10 border-red-500/20", bar: "bg-red-500" },
};

function ScoreBar({ label, score, bar }: { label: string; score: number; bar: string }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-xs font-semibold text-slate-300">{Math.round(score)}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${bar}`}
                    style={{ width: `${Math.min(100, Math.round(score))}%` }}
                />
            </div>
        </div>
    );
}

export default function MatchScoreCard({ match, loading }: Props) {

    if (loading) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4
                      flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-blue-400
                        border-t-transparent animate-spin shrink-0" />
                <p className="text-sm text-slate-400">Calcul du score en cours...</p>
            </div>
        );
    }

    if (!match) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-500">Score de matching non disponible.</p>
            </div>
        );
    }

    const cfg = NIVEAU_CONFIG[match.niveau] ?? NIVEAU_CONFIG["PARTIEL"];

    return (
        <div className="space-y-4">

            {/* Score global */}
            <div className={`rounded-xl border px-5 py-4 flex items-center justify-between ${cfg.bg}`}>
                <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">
                        Score de matching
                    </p>
                    <p className={`text-3xl font-bold ${cfg.color}`}>
                        {match.score_total}
                        <span className="text-lg font-normal text-slate-500">/100</span>
                    </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                </span>
            </div>

            {/* Barres de sous-scores */}
            <div className="space-y-2.5">
                <ScoreBar label="Compétences" score={match.score_skills} bar={cfg.bar} />
                <ScoreBar label="Expérience" score={match.score_experience} bar={cfg.bar} />
                <ScoreBar label="Sémantique" score={match.score_semantique} bar={cfg.bar} />
                <ScoreBar label="Formation" score={match.score_formation} bar={cfg.bar} />
            </div>

            {/* Détail compétences */}
            {match.skills_detail && (
                <div className="space-y-2">
                    {match.skills_detail.matchees.length > 0 && (
                        <div>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1.5">
                                Compétences ✓
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {match.skills_detail.matchees.map((s) => (
                                    <span key={s}
                                        className="px-2 py-0.5 rounded-md text-xs bg-green-500/15
                               text-green-300 border border-green-500/20">
                                        ✓ {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {match.skills_detail.manquantes.length > 0 && (
                        <div>
                            <p className="text-[11px] text-slate-500 uppercase tracking-wide mb-1.5">
                                Compétences manquantes
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {match.skills_detail.manquantes.map((s) => (
                                    <span key={s}
                                        className="px-2 py-0.5 rounded-md text-xs bg-red-500/10
                               text-red-400 border border-red-500/20">
                                        ✗ {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Explication LLM */}
            {(match.points_forts || match.points_faibles || match.recommandation) && (
                <div className="rounded-xl bg-white/3 border border-white/10 p-4 space-y-2.5">
                    {match.points_forts && (
                        <div>
                            <p className="text-[11px] font-bold text-green-500/80 uppercase tracking-wide mb-1">
                                Points forts
                            </p>
                            <p className="text-xs text-slate-300 leading-relaxed">{match.points_forts}</p>
                        </div>
                    )}
                    {match.points_faibles && (
                        <div>
                            <p className="text-[11px] font-bold text-amber-500/80 uppercase tracking-wide mb-1">
                                Points faibles
                            </p>
                            <p className="text-xs text-slate-300 leading-relaxed">{match.points_faibles}</p>
                        </div>
                    )}
                    {match.recommandation && (
                        <div className="pt-1 border-t border-white/10">
                            <p className="text-xs font-semibold text-blue-300">
                                → {match.recommandation}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}