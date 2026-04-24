import api from "./api";

/* ═════════════════════════════════════════════════════════════════
   TYPES COMMUNS
   ═════════════════════════════════════════════════════════════════ */

export type BenchmarkKind = "PARSER" | "MATCHING";
export type BenchmarkStatut = "EN_ATTENTE" | "EN_COURS" | "TERMINE" | "ECHEC";

/* ═════════════════════════════════════════════════════════════════
   TYPES PARSER
   ═════════════════════════════════════════════════════════════════ */

export interface FieldScore {
    score: number;
    type: string;
    pred?: string | string[] | null;
    truth?: string | string[] | null;
    precision?: number;
    recall?: number;
    f1?: number;
    matched?: number;
    pred_count?: number;
    truth_count?: number;
    avg_match_sim?: number;
    matched_pairs?: string[][];
    unmatched_pred?: string[];
    unmatched_truth?: string[];
}

export interface CvResult {
    id: string;
    status: "ok" | "error";
    cv_score: number;
    fields: Record<string, FieldScore>;
    error?: string;
}

export interface ParserBenchmarkDetail {
    cv_count: number;
    cv_success_count: number;
    global_score: number;
    field_summary: Record<string, number>;
    cv_results: CvResult[];
    elapsed_seconds: number;
}

/* ═════════════════════════════════════════════════════════════════
   TYPES MATCHING
   ═════════════════════════════════════════════════════════════════ */

export interface MatchingPerClassMetrics {
    label: string;
    precision: number;
    recall: number;
    f1: number;
    support: number;
}

export interface MatchingClassificationReport {
    accuracy: number;
    f1_macro: number;
    per_class: MatchingPerClassMetrics[];
}

export interface MatchingRankingMetrics {
    spearman_rho_mean: number;
    ndcg_mean: number;
    n_groups: number;
}

export interface MatchingConfigWeights {
    skills: number;
    experience: number;
    semantic: number;
    formation: number;
    description?: string;
}

export interface MatchingConfigResult {
    config_name: string;
    description: string;
    weights: MatchingConfigWeights;
    classification: MatchingClassificationReport;
    confusion_matrix: number[][];
    ranking: MatchingRankingMetrics;
}

export interface MatchingBenchmarkDetail {
    n_pairs: number;
    n_offres: number;
    best_config: string;
    configs: Record<string, MatchingConfigResult>;
    label_distribution: Record<string, number>;
    errors: Array<{ cv_id: string; offre_id: string; error: string }>;
    elapsed_seconds: number;
}

/* ═════════════════════════════════════════════════════════════════
   TYPES RUN (communs aux deux)
   ═════════════════════════════════════════════════════════════════ */

export interface BenchmarkRunSummary {
    id: string;
    kind: BenchmarkKind;
    statut: BenchmarkStatut;
    model_name: string | null;
    parser_preset: string | null;
    dataset_name: string;
    dataset_size: number;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    global_score: number | null;
    field_summary: Record<string, number> | null;
    error_message: string | null;
}

export type BenchmarkDetailPayload =
    | ParserBenchmarkDetail
    | MatchingBenchmarkDetail
    | null;

export interface BenchmarkRunDetail extends BenchmarkRunSummary {
    detail: BenchmarkDetailPayload;
}

export interface BenchmarkRunCreate {
    kind?: BenchmarkKind;
    parser_preset?: string;
    model_name?: string;
}

/* ═════════════════════════════════════════════════════════════════
   TYPES DATASET VIEWS
   ═════════════════════════════════════════════════════════════════ */

export interface DatasetCvEntry {
    id: string;
    text: string;
    expected: Record<string, unknown> | null;
}

export interface MatchingCandidate {
    cv_id: string;
    label: string;
    cv_data: Record<string, unknown> | null;
}

export interface MatchingOffreEntry {
    offre_id: string;
    offre: {
        titre: string;
        description: string;
        domaine: string;
        competences_requises: string[];
        annees_experience_min: number;
    };
    candidats: MatchingCandidate[];
}

/* ═════════════════════════════════════════════════════════════════
   TYPE GUARDS (discrimination par kind)
   ═════════════════════════════════════════════════════════════════ */

export function isParserDetail(
    detail: BenchmarkDetailPayload,
    kind: BenchmarkKind
): detail is ParserBenchmarkDetail {
    return kind === "PARSER" && detail !== null && "cv_results" in detail;
}

export function isMatchingDetail(
    detail: BenchmarkDetailPayload,
    kind: BenchmarkKind
): detail is MatchingBenchmarkDetail {
    return kind === "MATCHING" && detail !== null && "configs" in detail;
}

/* ═════════════════════════════════════════════════════════════════
   SERVICE
   ═════════════════════════════════════════════════════════════════ */

const benchmarkService = {
    /** Lance un nouveau benchmark — retourne le run en statut EN_ATTENTE. */
    launch: async (body: BenchmarkRunCreate = {}): Promise<BenchmarkRunSummary> => {
        const { data } = await api.post<BenchmarkRunSummary>("/benchmark/", body);
        return data;
    },

    /** Liste les runs récents, éventuellement filtrés par type. */
    list: async (limit = 50, kind?: BenchmarkKind): Promise<BenchmarkRunSummary[]> => {
        const params: Record<string, unknown> = { limit };
        if (kind) params.kind = kind;
        const { data } = await api.get<BenchmarkRunSummary[]>("/benchmark/", { params });
        return data;
    },

    /** Détail complet d'un run (parser ou matching). */
    getDetail: async (runId: string): Promise<BenchmarkRunDetail> => {
        const { data } = await api.get<BenchmarkRunDetail>(`/benchmark/${runId}`);
        return data;
    },

    /** Texte brut + annotations attendues d'un CV du dataset PARSER. */
    getCvText: async (cvId: string): Promise<DatasetCvEntry> => {
        const { data } = await api.get<DatasetCvEntry>(`/benchmark/dataset/${cvId}`);
        return data;
    },

    /** Infos d'une offre + candidats du dataset MATCHING. */
    getMatchingOffre: async (offreId: string): Promise<MatchingOffreEntry> => {
        const { data } = await api.get<MatchingOffreEntry>(
            `/benchmark/matching-dataset/${offreId}`
        );
        return data;
    },
};

export default benchmarkService;