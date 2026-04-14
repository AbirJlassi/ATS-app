/**
 * MatchScoreCard — Score de matching IA .
 * Design : score global + anneau SVG · décomposition pondérée · waterfall points ·
 *          adéquation compétences deux colonnes · analyse LLM structurée.
 */

interface SkillsDetail {
    matchees: string[];
    manquantes: string[];
}

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

interface Props {
    match: MatchResult | null | undefined;
    loading?: boolean;
}

/* ── Config par niveau ── */
const NIVEAU_CONFIG: Record<
    string,
    {
        label: string;
        ringStroke: string;
        ringBg: string;
        scoreColor: string;
        badgeBg: string;
        badgeText: string;
        badgeBorder: string;
        badgeDot: string;
        barColor: string;
        fillColor: string;
    }
> = {
    EXCELLENT: {
        label: "Excellent",
        ringStroke: "#3B6D11",
        ringBg: "#C0DD97",
        scoreColor: "text-green-400 dark:text-green-300",
        badgeBg: "bg-green-500/10",
        badgeText: "text-green-700 dark:text-green-300",
        badgeBorder: "border-green-500/30",
        badgeDot: "bg-green-600 dark:bg-green-400",
        barColor: "bg-green-500",
        fillColor: "#3B6D11",
    },
    BON: {
        label: "Bon match",
        ringStroke: "#185FA5",
        ringBg: "#85B7EB",
        scoreColor: "text-blue-400 dark:text-blue-300",
        badgeBg: "bg-blue-500/10",
        badgeText: "text-blue-700 dark:text-blue-300",
        badgeBorder: "border-blue-500/30",
        badgeDot: "bg-blue-600 dark:bg-blue-400",
        barColor: "bg-blue-500",
        fillColor: "#185FA5",
    },
    PARTIEL: {
        label: "Match partiel",
        ringStroke: "#BA7517",
        ringBg: "#EF9F27",
        scoreColor: "text-amber-400 dark:text-amber-300",
        badgeBg: "bg-amber-500/10",
        badgeText: "text-amber-700 dark:text-amber-300",
        badgeBorder: "border-amber-500/30",
        badgeDot: "bg-amber-600 dark:bg-amber-400",
        barColor: "bg-amber-500",
        fillColor: "#BA7517",
    },
    FAIBLE: {
        label: "Faible match",
        ringStroke: "#A32D2D",
        ringBg: "#F09595",
        scoreColor: "text-red-400 dark:text-red-300",
        badgeBg: "bg-red-500/10",
        badgeText: "text-red-700 dark:text-red-300",
        badgeBorder: "border-red-500/30",
        badgeDot: "bg-red-600 dark:bg-red-400",
        barColor: "bg-red-500",
        fillColor: "#A32D2D",
    },
};

/* Poids réels du moteur de matching */
const CRITERIA = [
    { key: "score_skills", label: "Compétences", weight: 35 },
    { key: "score_experience", label: "Expérience", weight: 25 },
    { key: "score_semantique", label: "Sémantique IA", weight: 25 },
    { key: "score_formation", label: "Formation", weight: 15 },
] as const;

/* Waterfall : couleurs fixes par critère (indépendant du niveau) */
const WATERFALL_COLORS = ["#3B6D11", "#639922", "#97C459", "#BA7517"];

/* ── Anneau SVG ── */
function ScoreRing({
    score,
    stroke,
    bg,
}: {
    score: number;
    stroke: string;
    bg: string;
}) {
    const r = 28;
    const circ = 2 * Math.PI * r; // ≈ 175.93
    const offset = circ - (Math.min(100, score) / 100) * circ;
    return (
        <svg width="68" height="68" viewBox="0 0 68 68" fill="none">
            <circle cx="34" cy="34" r={r} stroke={bg} strokeWidth="6" />
            <circle
                cx="34"
                cy="34"
                r={r}
                stroke={stroke}
                strokeWidth="6"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform="rotate(-90 34 34)"
                style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.22,1,.36,1)" }}
            />
            <text
                x="34"
                y="39"
                textAnchor="middle"
                fontSize="14"
                fontWeight="500"
                fill={stroke}
                fontFamily="inherit"
            >
                {Math.round(score)}
            </text>
        </svg>
    );
}

/* ── Barre de critère avec poids ── */
function CriteriaRow({
    label,
    weight,
    score,
    barColor,
    cfg,
}: {
    label: string;
    weight: number;
    score: number;
    barColor: string;
    fillColor: string;
    cfg: (typeof NIVEAU_CONFIG)[string];
}) {
    const pct = Math.min(100, Math.round(score));
    const isWeak = pct < 60;
    return (
        <div className="grid items-center gap-3" style={{ gridTemplateColumns: "150px 1fr 44px" }}>
            <div className="flex flex-col gap-0.5">
                <span className="text-sm text-gray-900 dark:text-slate-200">{label}</span>
                <span className="text-[11px] text-gray-400 dark:text-slate-500">
                    Poids {weight}%
                </span>
            </div>
            <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${isWeak ? "bg-amber-500" : barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span
                className={`text-sm font-medium text-right ${isWeak ? "text-amber-500 dark:text-amber-400" : cfg.scoreColor}`}
            >
                {pct}%
            </span>
        </div>
    );
}

/* ── Composant principal ── */
export default function MatchScoreCard({ match, loading }: Props) {
    /* État loading */
    if (loading) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
                <p className="text-sm text-slate-400">Calcul du score en cours…</p>
            </div>
        );
    }

    /* Pas de résultat */
    if (!match) {
        return (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-slate-500">Score de matching non disponible.</p>
            </div>
        );
    }

    const cfg = NIVEAU_CONFIG[match.niveau] ?? NIVEAU_CONFIG["PARTIEL"];

    /* Points obtenus par critère */
    const pts = CRITERIA.map((c) => ({
        ...c,
        score: match[c.key],
        points: Math.round((match[c.key] / 100) * c.weight * 10) / 10,
    }));
    const totalPts = pts.reduce((acc, c) => acc + c.points, 0);

    /* Largeurs waterfall en % de la barre (somme = score_total) */
    const wfTotal = Math.max(totalPts, 1);
    const wfWidths = pts.map((c) => (c.points / wfTotal) * Math.min(totalPts, 100));

    /* Équation synthétique */
    const equation = pts
        .map((c) => `${Math.round(c.score)}%×${c.weight}`)
        .join(" + ");

    return (
        <div className="space-y-0 rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-900">

            {/* ── Hero : score + anneau ── */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/10 dark:border-white/10">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-1">
                        Score de matching
                    </p>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-5xl font-medium leading-none ${cfg.scoreColor}`}>
                            {Math.round(match.score_total)}
                        </span>
                        <span className="text-base text-gray-400 dark:text-slate-500">/100</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">
                        Basé sur 4 critères pondérés
                    </p>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                    <ScoreRing
                        score={match.score_total}
                        stroke={cfg.ringStroke}
                        bg={cfg.ringBg}
                    />
                    <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.badgeDot}`} />
                        {cfg.label}
                    </span>
                </div>
            </div>

            {/* ── Décomposition pondérée ── */}
            <div className="px-6 py-5 border-b border-black/10 dark:border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-4">
                    Décomposition du score
                </p>

                <div className="space-y-3">
                    {pts.map((c) => (
                        <CriteriaRow
                            key={c.key}
                            label={c.label}
                            weight={c.weight}
                            score={c.score}
                            barColor={cfg.barColor}
                            fillColor={cfg.fillColor}
                            cfg={cfg}
                        />
                    ))}
                </div>

                {/* Barre waterfall */}
                <div className="mt-5">
                    <div className="flex h-7 rounded-lg overflow-hidden gap-px">
                        {pts.map((c, i) => (
                            <div
                                key={c.key}
                                className="flex items-center justify-center text-[11px] font-medium transition-all duration-700"
                                style={{
                                    width: `${wfWidths[i]}%`,
                                    background: WATERFALL_COLORS[i],
                                    color: i < 2 ? "#EAF3DE" : i === 2 ? "#27500A" : "#FAEEDA",
                                    minWidth: c.points > 0 ? "28px" : "0",
                                }}
                            >
                                {c.points > 1 ? `${c.points}` : ""}
                            </div>
                        ))}
                        {/* Zone vide restante */}
                        {totalPts < 100 && (
                            <div
                                className="flex-1 bg-black/5 dark:bg-white/5"
                                style={{ minWidth: 0 }}
                            />
                        )}
                    </div>

                    {/* Légende waterfall */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                        {pts.map((c, i) => (
                            <span
                                key={c.key}
                                className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500"
                            >
                                <span
                                    className="w-2 h-2 rounded-sm flex-shrink-0"
                                    style={{ background: WATERFALL_COLORS[i] }}
                                />
                                {c.label} {c.points} pts
                            </span>
                        ))}
                    </div>

                    {/* Équation */}
                    <div className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                        <span className="text-[11px] text-gray-400 dark:text-slate-500 leading-relaxed">
                            {equation}
                        </span>
                        <span className={`text-sm font-medium ml-3 shrink-0 ${cfg.scoreColor}`}>
                            = {Math.round(totalPts * 10) / 10} pts
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Adéquation compétences ── */}
            {match.skills_detail && (
                <div className="px-6 py-5 border-b border-black/10 dark:border-white/10">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                            Adéquation des compétences
                        </p>
                        {(match.skills_detail.matchees.length > 0 || match.skills_detail.manquantes.length > 0) && (
                            <span className="text-[11px] text-gray-400 dark:text-slate-500">
                                {match.skills_detail.matchees.length} /{" "}
                                {match.skills_detail.matchees.length + match.skills_detail.manquantes.length}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Présentes */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span className="text-[11px] text-gray-400 dark:text-slate-500">
                                    Présentes ({match.skills_detail.matchees.length})
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {match.skills_detail.matchees.map((s) => (
                                    <span
                                        key={s}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20"
                                    >
                                        <span className="text-[10px]">✓</span> {s}
                                    </span>
                                ))}
                                {match.skills_detail.matchees.length === 0 && (
                                    <span className="text-xs text-gray-400 dark:text-slate-500 italic">Aucune</span>
                                )}
                            </div>
                        </div>

                        {/* Manquantes */}
                        <div>
                            <div className="flex items-center gap-1.5 mb-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                <span className="text-[11px] text-gray-400 dark:text-slate-500">
                                    Manquantes ({match.skills_detail.manquantes.length})
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {match.skills_detail.manquantes.map((s) => (
                                    <span
                                        key={s}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                                    >
                                        <span className="text-[10px]">✗</span> {s}
                                    </span>
                                ))}
                                {match.skills_detail.manquantes.length === 0 && (
                                    <span className="text-xs text-gray-400 dark:text-slate-500 italic">Aucune</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Analyse IA ── */}
            {(match.points_forts || match.points_faibles || match.recommandation) && (
                <div className="px-6 py-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500 mb-4">
                        Analyse IA
                    </p>
                    <div className="space-y-3">
                        {match.points_forts && (
                            <div className="flex gap-3 p-3 rounded-xl bg-green-500/8 dark:bg-green-500/5 border-l-2 border-green-600 dark:border-green-500">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1">
                                        Points forts
                                    </p>
                                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
                                        {match.points_forts}
                                    </p>
                                </div>
                            </div>
                        )}
                        {match.points_faibles && (
                            <div className="flex gap-3 p-3 rounded-xl bg-amber-500/8 dark:bg-amber-500/5 border-l-2 border-amber-600 dark:border-amber-500">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
                                        Points d'attention
                                    </p>
                                    <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
                                        {match.points_faibles}
                                    </p>
                                </div>
                            </div>
                        )}
                        {match.recommandation && (
                            <div className="flex gap-3 p-3 rounded-xl bg-blue-500/8 dark:bg-blue-500/5 border-l-2 border-blue-600 dark:border-blue-500">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-1">
                                        Recommandation
                                    </p>
                                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 leading-relaxed">
                                        {match.recommandation}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}