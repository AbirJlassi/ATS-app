/**
 * BenchmarkTab.tsx — Onglet Qualité IA dans l'AdminDashboard
 *
 * Deux types de benchmarks :
 *   - PARSER   : évaluation du parser CV (presets LLM, par champ)
 *   - MATCHING : ablation study du moteur de matching (4 configs)
 *
 * Accessible via /admin/dashboard?tab=benchmark
 */
import { useEffect, useRef, useState } from "react";
import {
  Play,
  Loader2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  BarChart3,
  FlaskConical,
  FileText,
  GitCompareArrows,
  Check,
  X as XIcon,
  Minus,
  Target,
  Layers,
  Award,
  TrendingUp,
} from "lucide-react";
import benchmarkService, {
  type BenchmarkRunSummary,
  type BenchmarkRunDetail,
  type CvResult,
  type FieldScore,
  type BenchmarkStatut,
  type BenchmarkKind,
  type DatasetCvEntry,
  type MatchingBenchmarkDetail,
  type MatchingConfigResult,
  type ParserBenchmarkDetail,
  isParserDetail,
  isMatchingDetail,
} from "@/services/benchmarkService";

/* ── Presets disponibles (PARSER uniquement) ───────────────── */
const PRESETS = [
  { value: "fast", label: "Fast", desc: "llama-3.1-8b — rapide, CVs standards" },
  { value: "accurate", label: "Accurate", desc: "llama-3.3-70b — CVs complexes" },
  { value: "fastest", label: "Fastest", desc: "gpt-oss-20b — latence minimale" },
  { value: "best", label: "Best", desc: "gpt-oss-120b — qualité maximale" },
  { value: "multilingual", label: "Multilingual", desc: "qwen3-32b — FR/AR/EN" },
] as const;

/* ── Helpers ───────────────────────────────────────────────── */

const isRunning = (s: BenchmarkStatut) => s === "EN_ATTENTE" || s === "EN_COURS";

const fmt = (n: number | null | undefined) =>
  n != null ? `${(n * 100).toFixed(1)}%` : "—";

const fmtScore = (n: number | null | undefined, digits = 3) =>
  n != null ? n.toFixed(digits) : "—";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const STATUT_UI: Record<BenchmarkStatut, { icon: React.ReactNode; label: string; color: string }> = {
  EN_ATTENTE: { icon: <Clock className="w-3.5 h-3.5" />, label: "En attente", color: "text-slate-400" },
  EN_COURS: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: "En cours", color: "text-blue-400" },
  TERMINE: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Terminé", color: "text-emerald-400" },
  ECHEC: { icon: <XCircle className="w-3.5 h-3.5" />, label: "Échec", color: "text-red-400" },
};

const scoreColor = (s: number) =>
  s >= 0.9 ? "text-emerald-400" : s >= 0.7 ? "text-amber-400" : s >= 0.4 ? "text-orange-400" : "text-red-400";

const scoreBg = (s: number) =>
  s >= 0.9 ? "bg-emerald-500/15" : s >= 0.7 ? "bg-amber-500/15" : s >= 0.4 ? "bg-orange-500/15" : "bg-red-500/15";

const METRIC_LABELS: Record<string, string> = {
  scalar_exact: "Exact match",
  scalar_phone: "Normalisation tél.",
  scalar_url: "Normalisation URL",
  scalar_fuzzy: "Levenshtein normalisé",
  scalar_containment: "Containment bilatéral",
  flat_list: "F1 fuzzy (greedy)",
  structured_list: "F1 bipartite pondéré",
  fallback: "Fallback",
};

/* ── Labels et couleurs des classes de matching ───────────── */
const MATCHING_LABELS = ["No Fit", "Potential Fit", "Good Fit"] as const;
const MATCHING_LABEL_COLORS: Record<string, string> = {
  "No Fit": "#ef4444",
  "Potential Fit": "#f59e0b",
  "Good Fit": "#10b981",
};

/* ── Barre de score SVG ───────────────────────────────────── */
function ScoreBar({ score, width = 120 }: { score: number; width?: number }) {
  const fill = score >= 0.9 ? "#34d399" : score >= 0.7 ? "#fbbf24" : score >= 0.4 ? "#fb923c" : "#f87171";
  return (
    <svg width={width} height={8} className="rounded-full overflow-hidden">
      <rect width={width} height={8} fill="var(--surface-hover)" rx={4} />
      <rect width={Math.max(0, width * Math.min(1, score))} height={8} fill={fill} rx={4} />
    </svg>
  );
}

/* ── Types de vue ─────────────────────────────────────────── */
type ViewMode = "list" | "detail" | "compare";

/* ══════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
export default function BenchmarkTab() {
  const [activeKind, setActiveKind] = useState<BenchmarkKind>("PARSER");
  const [runs, setRuns] = useState<BenchmarkRunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [preset, setPreset] = useState("fast");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");

  const [detail, setDetail] = useState<BenchmarkRunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedCv, setExpandedCv] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchRuns(activeKind);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKind]);

  const fetchRuns = async (kind: BenchmarkKind) => {
    setLoading(true);
    try { setRuns(await benchmarkService.list(20, kind)); }
    catch { setError("Impossible de charger l'historique."); }
    finally { setLoading(false); }
  };

  const handleLaunch = async () => {
    setLaunching(true); setError(null);
    try {
      const body = activeKind === "PARSER"
        ? { kind: "PARSER" as const, parser_preset: preset }
        : { kind: "MATCHING" as const };
      const run = await benchmarkService.launch(body);
      setRuns((prev) => [run, ...prev]);
      startPolling(run.id);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? "Erreur lors du lancement du benchmark.";
      setError(typeof msg === "string" ? msg : "Erreur lors du lancement.");
    }
    finally { setLaunching(false); }
  };

  const startPolling = (runId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const fresh = await benchmarkService.getDetail(runId);
        setRuns((prev) => prev.map((r) => (r.id === runId ? fresh : r)));
        setDetail((prev) => (prev?.id === runId ? fresh : prev));
        if (!isRunning(fresh.statut)) { clearInterval(pollRef.current!); pollRef.current = null; }
      } catch { /* silencieux */ }
    }, 3000);
  };

  const openDetail = async (runId: string) => {
    setDetailLoading(true); setExpandedCv(null);
    try {
      const d = await benchmarkService.getDetail(runId);
      setDetail(d); setView("detail");
      if (isRunning(d.statut)) startPolling(d.id);
    } catch { setError("Impossible de charger le détail."); }
    finally { setDetailLoading(false); }
  };

  const switchKind = (kind: BenchmarkKind) => {
    if (kind === activeKind) return;
    setActiveKind(kind);
    setView("list");
    setDetail(null);
    setError(null);
  };

  const completedParserRuns = runs.filter(
    (r) => r.kind === "PARSER" && r.statut === "TERMINE" && r.global_score != null
  );

  /* ── Rendu des vues détail / compare ── */
  if (view === "detail" && detail) {
    if (isMatchingDetail(detail.detail, detail.kind)) {
      return (
        <MatchingDetailView
          detail={detail}
          matching={detail.detail}
          onBack={() => setView("list")}
        />
      );
    }
    if (isParserDetail(detail.detail, detail.kind) || detail.kind === "PARSER") {
      return (
        <ParserDetailView
          detail={detail}
          expandedCv={expandedCv}
          setExpandedCv={setExpandedCv}
          onBack={() => setView("list")}
        />
      );
    }
  }

  if (view === "compare") {
    return <CompareView runs={completedParserRuns} onBack={() => setView("list")} />;
  }

  /* ══════════════════════════════════════════════════════════════
     VUE LISTE
     ══════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-5 h-5" style={{ color: "var(--brand-accent)" }} />
            <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Qualité de l'IA</h2>
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Évaluation quantitative du parser CV et du moteur de matching.
          </p>
        </div>
        {activeKind === "PARSER" && completedParserRuns.length >= 2 && (
          <button onClick={() => setView("compare")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-500 text-sm font-semibold hover:bg-blue-500/20 transition-all">
            <GitCompareArrows className="w-4 h-4" /> Comparer ({completedParserRuns.length})
          </button>
        )}
      </div>

      {/* Tabs Parser / Matching */}
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "var(--surface-hover)" }}>
        <button onClick={() => switchKind("PARSER")}
          className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeKind === "PARSER"
              ? "shadow-sm"
              : "opacity-60 hover:opacity-90"
            }`}
          style={{
            background: activeKind === "PARSER" ? "var(--surface-card)" : "transparent",
            color: activeKind === "PARSER" ? "var(--brand-accent)" : "var(--text-secondary)",
          }}>
          <FileText className="w-4 h-4" /> Parser CV
        </button>
        <button onClick={() => switchKind("MATCHING")}
          className={`flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeKind === "MATCHING"
              ? "shadow-sm"
              : "opacity-60 hover:opacity-90"
            }`}
          style={{
            background: activeKind === "MATCHING" ? "var(--surface-card)" : "transparent",
            color: activeKind === "MATCHING" ? "var(--brand-accent)" : "var(--text-secondary)",
          }}>
          <Target className="w-4 h-4" /> Matching
        </button>
      </div>

      {/* Zone de lancement */}
      <div className="card">
        {activeKind === "PARSER" ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Preset du parser</label>
              <select value={preset} onChange={(e) => setPreset(e.target.value)} className="input max-w-xs">
                {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label} — {p.desc}</option>)}
              </select>
            </div>
            <button onClick={handleLaunch} disabled={launching || runs.some((r) => isRunning(r.statut))}
              className="btn bg-blue-600 text-white hover:bg-blue-500 shadow-md disabled:opacity-50 flex items-center gap-2">
              {launching ? <><Loader2 className="w-4 h-4 animate-spin" /> Lancement…</> : <><Play className="w-4 h-4" /> Lancer le benchmark</>}
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Benchmark matching</label>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                Ablation study : 4 configurations (skills_only, deterministic, full, semantic_only)
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Métriques : classification (F1, accuracy) + ranking (Spearman, nDCG)
              </p>
            </div>
            <button onClick={handleLaunch} disabled={launching || runs.some((r) => isRunning(r.statut))}
              className="btn bg-blue-600 text-white hover:bg-blue-500 shadow-md disabled:opacity-50 flex items-center gap-2 whitespace-nowrap">
              {launching ? <><Loader2 className="w-4 h-4 animate-spin" /> Lancement…</> : <><Play className="w-4 h-4" /> Lancer l'évaluation</>}
            </button>
          </div>
        )}
        {runs.some((r) => isRunning(r.statut)) && (
          <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="w-3 h-3 animate-spin" /> Un benchmark est en cours d'exécution…
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {/* Historique */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Historique des runs</h3>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-10" style={{ color: "var(--text-muted)" }}>
            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Aucun benchmark {activeKind === "PARSER" ? "parser" : "matching"} exécuté pour l'instant.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => <RunRow key={run.id} run={run} onOpen={() => openDetail(run.id)} />)}
          </div>
        )}
      </div>

      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="card flex items-center gap-3 px-6 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span style={{ color: "var(--text-primary)" }}>Chargement du rapport…</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RUN ROW
   ══════════════════════════════════════════════════════════════ */
function RunRow({ run, onOpen }: { run: BenchmarkRunSummary; onOpen: () => void }) {
  const s = STATUT_UI[run.statut];
  const badge = run.kind === "MATCHING" ? `${run.dataset_size} paires` : (run.parser_preset ?? "?");
  return (
    <button onClick={onOpen} disabled={isRunning(run.statut)}
      className="card-hover w-full text-left flex items-center gap-4 px-4 py-3 disabled:cursor-default group">
      <div className={`flex items-center gap-1.5 text-xs font-semibold min-w-[100px] ${s.color}`}>{s.icon} {s.label}</div>
      <span className="badge-accent text-[11px]">{badge}</span>
      <div className="flex-1 flex items-center gap-2">
        {run.global_score != null ? (
          <>
            <ScoreBar score={run.global_score} width={100} />
            <span className={`text-sm font-bold tabular-nums ${scoreColor(run.global_score)}`}>{fmt(run.global_score)}</span>
            {run.kind === "MATCHING" && (
              <span className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>F1 macro</span>
            )}
          </>
        ) : run.statut === "ECHEC" ? (
          <span className="text-xs text-red-400 truncate max-w-[200px]">{run.error_message}</span>
        ) : <span className="text-xs" style={{ color: "var(--text-muted)" }}>—</span>}
      </div>
      <span className="text-xs tabular-nums hidden sm:block" style={{ color: "var(--text-muted)" }}>{fmtDate(run.created_at)}</span>
      {!isRunning(run.statut) && <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: "var(--text-muted)" }} />}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   VUE DÉTAIL PARSER
   ══════════════════════════════════════════════════════════════ */
function ParserDetailView({ detail, expandedCv, setExpandedCv, onBack }: {
  detail: BenchmarkRunDetail;
  expandedCv: string | null;
  setExpandedCv: (id: string | null) => void;
  onBack: () => void;
}) {
  const d = detail.detail as ParserBenchmarkDetail | null;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: "var(--text-secondary)", background: "var(--surface-hover)" }}>← Retour</button>
        <div className="flex-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Parser — {detail.parser_preset}</h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {fmtDate(detail.created_at)} · {d?.cv_success_count ?? 0}/{d?.cv_count ?? 0} CVs · {d?.elapsed_seconds ?? 0}s
          </p>
        </div>
        {detail.global_score != null && (
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Score global</p>
            <p className={`text-2xl font-black tabular-nums ${scoreColor(detail.global_score)}`}>{fmt(detail.global_score)}</p>
          </div>
        )}
      </div>

      {detail.statut === "ECHEC" && detail.error_message && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{detail.error_message}</div>
      )}
      {isRunning(detail.statut) && (
        <div className="card flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span style={{ color: "var(--text-secondary)" }}>Benchmark en cours…</span>
        </div>
      )}

      {detail.field_summary && (
        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>Score moyen par champ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
            {Object.entries(detail.field_summary).sort(([, a], [, b]) => a - b).map(([field, score]) => (
              <div key={field} className="flex items-center gap-3">
                <span className="text-sm min-w-[110px] font-medium truncate" style={{ color: "var(--text-secondary)" }}>{field}</span>
                <ScoreBar score={score} width={80} />
                <span className={`text-xs font-bold tabular-nums min-w-[42px] text-right ${scoreColor(score)}`}>{fmt(score)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d?.cv_results && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>Résultats par CV</h3>
          <div className="space-y-1.5">
            {d.cv_results.map((cv) => (
              <CvRow key={cv.id} cv={cv} expanded={expandedCv === cv.id} onToggle={() => setExpandedCv(expandedCv === cv.id ? null : cv.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   VUE DÉTAIL MATCHING
   ══════════════════════════════════════════════════════════════ */
function MatchingDetailView({ detail, matching, onBack }: {
  detail: BenchmarkRunDetail;
  matching: MatchingBenchmarkDetail;
  onBack: () => void;
}) {
  const [expandedConfig, setExpandedConfig] = useState<string | null>(null);

  const configOrder = ["skills_only", "deterministic", "full", "semantic_only"];
  const orderedConfigs = configOrder
    .filter((k) => k in matching.configs)
    .map((k) => [k, matching.configs[k]] as [string, MatchingConfigResult]);

  // Max values for highlighting best per column
  const maxF1 = Math.max(...orderedConfigs.map(([, c]) => c.classification.f1_macro));
  const maxAcc = Math.max(...orderedConfigs.map(([, c]) => c.classification.accuracy));
  const maxNdcg = Math.max(...orderedConfigs.map(([, c]) => c.ranking.ndcg_mean));
  const maxSpearman = Math.max(...orderedConfigs.map(([, c]) => c.ranking.spearman_rho_mean));

  const totalPairs = matching.n_pairs;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: "var(--text-secondary)", background: "var(--surface-hover)" }}>← Retour</button>
        <div className="flex-1">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Target className="w-5 h-5" style={{ color: "var(--brand-accent)" }} />
            Évaluation matching — Ablation study
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {fmtDate(detail.created_at)} · {matching.n_offres} offres × {matching.n_pairs} paires · {matching.elapsed_seconds}s
          </p>
        </div>
      </div>

      {detail.statut === "ECHEC" && detail.error_message && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{detail.error_message}</div>
      )}
      {isRunning(detail.statut) && (
        <div className="card flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
          <span style={{ color: "var(--text-secondary)" }}>Benchmark en cours…</span>
        </div>
      )}

      {/* Best config highlight */}
      <div className="card" style={{
        background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.05))",
        borderColor: "rgba(59,130,246,0.25)",
      }}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(59,130,246,0.15)" }}>
            <Award className="w-6 h-6 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>
              Meilleure configuration
            </p>
            <h3 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              {matching.best_config}
            </h3>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {matching.configs[matching.best_config]?.description}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>F1 macro</p>
            <p className="text-2xl font-black tabular-nums text-blue-500">
              {fmtScore(matching.configs[matching.best_config]?.classification.f1_macro)}
            </p>
          </div>
        </div>
      </div>

      {/* Label distribution */}
      <div className="card">
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
          Distribution des labels (vérité terrain)
        </h3>
        <div className="space-y-2">
          {MATCHING_LABELS.map((label) => {
            const count = matching.label_distribution[label] ?? 0;
            const pct = totalPairs > 0 ? (count / totalPairs) * 100 : 0;
            return (
              <div key={label} className="flex items-center gap-3">
                <span className="text-sm min-w-[120px] font-medium" style={{ color: "var(--text-secondary)" }}>
                  {label}
                </span>
                <div className="flex-1 h-6 rounded-lg overflow-hidden" style={{ background: "var(--surface-hover)" }}>
                  <div className="h-full flex items-center px-2 text-xs font-semibold text-white"
                    style={{ width: `${pct}%`, background: MATCHING_LABEL_COLORS[label], minWidth: "32px" }}>
                    {count}
                  </div>
                </div>
                <span className="text-xs tabular-nums min-w-[50px] text-right" style={{ color: "var(--text-muted)" }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ablation comparison table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--surface-border)" }}>
          <Layers className="w-4 h-4" style={{ color: "var(--brand-accent)" }} />
          <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Comparaison des configurations
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--surface-border)", background: "var(--surface-card-alt)" }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Configuration</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>F1 macro</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Accuracy</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>nDCG</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Spearman ρ</th>
              </tr>
            </thead>
            <tbody>
              {orderedConfigs.map(([name, cfg]) => {
                const isBest = name === matching.best_config;
                const f1 = cfg.classification.f1_macro;
                const acc = cfg.classification.accuracy;
                const ndcg = cfg.ranking.ndcg_mean;
                const rho = cfg.ranking.spearman_rho_mean;
                return (
                  <tr key={name} style={{
                    borderBottom: "1px solid var(--surface-border)",
                    background: isBest ? "rgba(59,130,246,0.05)" : "transparent",
                  }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{name}</span>
                        {isBest && <Award className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {cfg.description}
                      </p>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-lg text-xs font-bold tabular-nums ${f1 === maxF1 ? "ring-1 ring-blue-400/50" : ""} ${scoreBg(f1)} ${scoreColor(f1)}`}>
                        {fmtScore(f1)}
                        {f1 === maxF1 && <Check className="w-3 h-3 inline ml-1" />}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`tabular-nums font-bold ${acc === maxAcc ? scoreColor(acc) + " underline decoration-2 underline-offset-4" : ""}`}
                        style={acc !== maxAcc ? { color: "var(--text-secondary)" } : {}}>
                        {fmtScore(acc)}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`tabular-nums font-bold ${ndcg === maxNdcg ? scoreColor(ndcg) + " underline decoration-2 underline-offset-4" : ""}`}
                        style={ndcg !== maxNdcg ? { color: "var(--text-secondary)" } : {}}>
                        {fmtScore(ndcg)}
                      </span>
                    </td>
                    <td className="text-center px-4 py-3">
                      <span className={`tabular-nums font-bold ${rho === maxSpearman ? "text-emerald-400 underline decoration-2 underline-offset-4" : rho < 0 ? "text-red-400" : ""}`}
                        style={rho !== maxSpearman && rho >= 0 ? { color: "var(--text-secondary)" } : {}}>
                        {fmtScore(rho)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1"><Award className="w-3 h-3 text-blue-500" /> Meilleure config (F1 macro)</span>
        <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Meilleur F1</span>
        <span className="flex items-center gap-1"><span className="underline decoration-2 underline-offset-2">souligné</span> Meilleur par colonne</span>
      </div>

      {/* Détail par config */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
          Détail par configuration
        </h3>
        <div className="space-y-1.5">
          {orderedConfigs.map(([name, cfg]) => (
            <ConfigCard
              key={name}
              name={name}
              config={cfg}
              isBest={name === matching.best_config}
              expanded={expandedConfig === name}
              onToggle={() => setExpandedConfig(expandedConfig === name ? null : name)}
            />
          ))}
        </div>
      </div>

      {/* Erreurs éventuelles */}
      {matching.errors && matching.errors.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3 text-red-400">
            Erreurs de calcul ({matching.errors.length})
          </h3>
          <div className="space-y-1 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            {matching.errors.slice(0, 10).map((e, i) => (
              <div key={i}>{e.offre_id} × {e.cv_id} : {e.error}</div>
            ))}
            {matching.errors.length > 10 && <p>… et {matching.errors.length - 10} autres</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CARD PAR CONFIGURATION (expandable)
   ══════════════════════════════════════════════════════════════ */
function ConfigCard({ name, config, isBest, expanded, onToggle }: {
  name: string;
  config: MatchingConfigResult;
  isBest: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const f1 = config.classification.f1_macro;

  return (
    <div className="card" style={{
      padding: 0,
      borderColor: isBest ? "rgba(59,130,246,0.35)" : undefined,
    }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity">
        {expanded
          ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
          : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{name}</span>
        {isBest && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-blue-500/15 text-blue-500">
            <Award className="w-3 h-3" /> Best
          </span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <ScoreBar score={f1} width={60} />
          <span className={`text-xs font-bold tabular-nums ${scoreColor(f1)}`}>{fmtScore(f1)}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-5" style={{ borderColor: "var(--surface-border)" }}>
          {/* Poids */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              Poids des composants
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["skills", "experience", "semantic", "formation"] as const).map((k) => {
                const w = config.weights[k];
                return (
                  <div key={k} className="rounded-lg px-3 py-2" style={{ background: "var(--surface-card-alt)", border: "1px solid var(--surface-border)" }}>
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{k}</p>
                    <p className="text-sm font-bold tabular-nums" style={{ color: w > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {(w * 100).toFixed(0)}%
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Métriques de ranking */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <TrendingUp className="w-3 h-3" /> Ranking
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-card-alt)", border: "1px solid var(--surface-border)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Spearman ρ</p>
                <p className={`text-sm font-bold tabular-nums ${config.ranking.spearman_rho_mean < 0 ? "text-red-400" : ""}`}
                  style={config.ranking.spearman_rho_mean >= 0 ? { color: "var(--text-primary)" } : {}}>
                  {fmtScore(config.ranking.spearman_rho_mean)}
                </p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-card-alt)", border: "1px solid var(--surface-border)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>nDCG moyen</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {fmtScore(config.ranking.ndcg_mean)}
                </p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "var(--surface-card-alt)", border: "1px solid var(--surface-border)" }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Groupes</p>
                <p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
                  {config.ranking.n_groups}
                </p>
              </div>
            </div>
          </div>

          {/* Confusion matrix */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              Matrice de confusion
            </p>
            <ConfusionMatrix matrix={config.confusion_matrix} labels={MATCHING_LABELS as unknown as string[]} />
          </div>

          {/* Classification report */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              Métriques par classe
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--surface-border)" }}>
                    <th className="text-left py-2 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Classe</th>
                    <th className="text-center py-2 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Precision</th>
                    <th className="text-center py-2 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Recall</th>
                    <th className="text-center py-2 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>F1</th>
                    <th className="text-center py-2 font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Support</th>
                  </tr>
                </thead>
                <tbody>
                  {config.classification.per_class.map((cls) => (
                    <tr key={cls.label} style={{ borderBottom: "1px solid var(--surface-border)" }}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: MATCHING_LABEL_COLORS[cls.label] }} />
                          <span className="font-medium" style={{ color: "var(--text-primary)" }}>{cls.label}</span>
                        </div>
                      </td>
                      <td className="text-center py-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtScore(cls.precision)}</td>
                      <td className="text-center py-2 tabular-nums" style={{ color: "var(--text-secondary)" }}>{fmtScore(cls.recall)}</td>
                      <td className={`text-center py-2 tabular-nums font-bold ${scoreColor(cls.f1)}`}>{fmtScore(cls.f1)}</td>
                      <td className="text-center py-2 tabular-nums" style={{ color: "var(--text-muted)" }}>{cls.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CONFUSION MATRIX
   ══════════════════════════════════════════════════════════════ */
function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ maxWidth: "500px" }}>
        <thead>
          <tr>
            <th className="py-1 px-2 text-left text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
              True ↓ / Pred →
            </th>
            {labels.map((label) => (
              <th key={label} className="py-1 px-2 text-[10px] uppercase tracking-wide"
                style={{ color: MATCHING_LABEL_COLORS[label] }}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className="py-1 px-2 font-semibold text-[11px]" style={{ color: MATCHING_LABEL_COLORS[labels[i]] }}>
                {labels[i]}
              </td>
              {row.map((val, j) => {
                const intensity = val / max;
                const isDiag = i === j;
                const bgAlpha = intensity * 0.6;
                const bg = isDiag
                  ? `rgba(16,185,129,${bgAlpha})`
                  : `rgba(239,68,68,${bgAlpha * 0.7})`;
                return (
                  <td key={j} className="py-3 px-2 text-center font-bold tabular-nums"
                    style={{
                      background: val > 0 ? bg : "var(--surface-card-alt)",
                      border: "1px solid var(--surface-border)",
                      color: intensity > 0.5 ? "white" : "var(--text-primary)",
                      minWidth: "56px",
                    }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] mt-2" style={{ color: "var(--text-muted)" }}>
        Diagonale (vert) = prédictions correctes · Hors diagonale (rouge) = erreurs
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   CV ROW (PARSER) — AVEC SUB-TABS
   ══════════════════════════════════════════════════════════════ */
function CvRow({ cv, expanded, onToggle }: { cv: CvResult; expanded: boolean; onToggle: () => void }) {
  const [subTab, setSubTab] = useState<"scores" | "source">("scores");
  const [cvText, setCvText] = useState<DatasetCvEntry | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const loadCvText = async () => {
    if (cvText) { setSubTab("source"); return; }
    setTextLoading(true);
    try { setCvText(await benchmarkService.getCvText(cv.id)); setSubTab("source"); }
    catch { /* silencieux */ }
    finally { setTextLoading(false); }
  };

  return (
    <div className="card" style={{ padding: 0 }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity">
        {expanded ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />}
        <span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{cv.id}</span>
        {cv.status === "error" ? <span className="badge-danger text-[11px]">Erreur</span> : (
          <div className="flex items-center gap-2">
            <ScoreBar score={cv.cv_score} width={60} />
            <span className={`text-xs font-bold tabular-nums ${scoreColor(cv.cv_score)}`}>{fmt(cv.cv_score)}</span>
          </div>
        )}
      </button>

      {expanded && cv.status === "ok" && (
        <div className="border-t" style={{ borderColor: "var(--surface-border)" }}>
          <div className="flex items-center gap-1 px-4 pt-3 pb-2">
            <button onClick={() => setSubTab("scores")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${subTab === "scores" ? "bg-blue-500/15 text-blue-500 border border-blue-500/25" : "text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"}`}>
              Scores & Comparaison
            </button>
            <button onClick={loadCvText} disabled={textLoading}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${subTab === "source" ? "bg-blue-500/15 text-blue-500 border border-blue-500/25" : "text-gray-500 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300"}`}>
              {textLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} CV Source
            </button>
          </div>

          {subTab === "scores" && (
            <div className="px-4 pb-4 pt-1 space-y-3">
              {Object.entries(cv.fields).map(([field, res]) => (
                <FieldCompareRow key={field} field={field} res={res} />
              ))}
            </div>
          )}

          {subTab === "source" && cvText && (
            <div className="px-4 pb-4 pt-1 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Texte brut du CV</p>
                <pre className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4 max-h-[400px] overflow-y-auto"
                  style={{ color: "var(--text-secondary)", background: "var(--surface-card-alt)", border: "1px solid var(--surface-border)", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "0.8rem" }}>
                  {cvText.text}
                </pre>
              </div>
              {cvText.expected && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Annotations attendues (ground truth)</p>
                  <pre className="text-sm leading-relaxed whitespace-pre-wrap rounded-xl p-4 max-h-[300px] overflow-y-auto"
                    style={{ color: "var(--text-secondary)", background: "var(--surface-card-alt)", border: "1px solid var(--surface-border)", fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "0.75rem" }}>
                    {JSON.stringify(cvText.expected, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {expanded && cv.status === "error" && (
        <div className="px-4 pb-4 pt-1 border-t" style={{ borderColor: "var(--surface-border)" }}>
          <p className="text-sm text-red-400">{cv.error ?? "Erreur inconnue"}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   COMPARAISON PRED / TRUTH POUR UN CHAMP (PARSER)
   ══════════════════════════════════════════════════════════════ */
function FieldCompareRow({ field, res }: { field: string; res: FieldScore }) {
  const isScalar = res.type.startsWith("scalar_") || res.type === "fallback";

  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-card-alt)", border: "1px solid var(--surface-border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{field}</span>
          <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ color: "var(--text-muted)", background: "var(--surface-hover)" }}>
            {METRIC_LABELS[res.type] ?? res.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBar score={res.score} width={50} />
          <span className={`text-sm font-bold tabular-nums ${scoreColor(res.score)}`}>{fmt(res.score)}</span>
        </div>
      </div>

      {isScalar ? (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Prédit</span>
            <p className="mt-0.5 font-mono" style={{ color: res.score >= 0.9 ? "var(--text-primary)" : "#f87171" }}>
              {res.pred != null ? String(res.pred) : <span style={{ color: "var(--text-muted)" }}>∅ (vide)</span>}
            </p>
          </div>
          <div>
            <span className="font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Attendu</span>
            <p className="mt-0.5 font-mono" style={{ color: "var(--text-primary)" }}>
              {res.truth != null ? String(res.truth) : <span style={{ color: "var(--text-muted)" }}>∅ (vide)</span>}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-3" style={{ color: "var(--text-muted)" }}>
            <span>P: <strong style={{ color: "var(--text-secondary)" }}>{fmt(res.precision)}</strong></span>
            <span>R: <strong style={{ color: "var(--text-secondary)" }}>{fmt(res.recall)}</strong></span>
            <span>Matchés: <strong style={{ color: "var(--text-secondary)" }}>{res.matched}/{res.truth_count}</strong></span>
          </div>

          {res.matched_pairs && res.matched_pairs.length > 0 && (
            <div className="space-y-1">
              {res.matched_pairs.map(([pred, truth], i) => (
                <div key={i} className="flex items-start gap-2 py-1 px-2 rounded-lg" style={{ background: "rgba(34,197,94,0.06)" }}>
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono" style={{ color: "var(--text-primary)" }}>{pred}</span>
                    {pred.toLowerCase() !== truth.toLowerCase() && (
                      <span className="ml-2" style={{ color: "var(--text-muted)" }}>← {truth}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {res.unmatched_pred && res.unmatched_pred.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Faux positifs (en trop)</span>
              {res.unmatched_pred.map((item, i) => (
                <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: "rgba(249,115,22,0.06)" }}>
                  <Minus className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                  <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{item}</span>
                </div>
              ))}
            </div>
          )}

          {res.unmatched_truth && res.unmatched_truth.length > 0 && (
            <div className="space-y-1">
              <span className="font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Manqués (faux négatifs)</span>
              {res.unmatched_truth.map((item, i) => (
                <div key={i} className="flex items-center gap-2 py-1 px-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)" }}>
                  <XIcon className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   VUE COMPARAISON CROSS-PRESETS (PARSER UNIQUEMENT)
   ══════════════════════════════════════════════════════════════ */
function CompareView({ runs, onBack }: { runs: BenchmarkRunSummary[]; onBack: () => void }) {
  const [details, setDetails] = useState<BenchmarkRunDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const latestByPreset = new Map<string, BenchmarkRunSummary>();
        for (const r of runs) {
          const key = r.parser_preset ?? "?";
          if (!latestByPreset.has(key)) latestByPreset.set(key, r);
        }
        const results = await Promise.all(
          Array.from(latestByPreset.values()).map((r) => benchmarkService.getDetail(r.id))
        );
        setDetails(results.filter((d) => d.detail != null));
      } catch { /* silencieux */ }
      finally { setLoading(false); }
    };
    load();
  }, [runs]);

  const allFields = Array.from(new Set(details.flatMap((d) => Object.keys(d.field_summary ?? {})))).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-20" style={{ color: "var(--text-muted)" }}>
        <Loader2 className="w-5 h-5 animate-spin" /> Chargement de la comparaison…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ color: "var(--text-secondary)", background: "var(--surface-hover)" }}>← Retour</button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <GitCompareArrows className="w-5 h-5" style={{ color: "var(--brand-accent)" }} />
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>Comparaison cross-presets</h2>
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Dernier run par preset — {details.length} presets comparés
          </p>
        </div>
      </div>

      {details.length < 2 ? (
        <div className="card text-center py-10">
          <p style={{ color: "var(--text-muted)" }}>Il faut au moins 2 presets différents pour comparer.</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Lancez des benchmarks avec différents presets.</p>
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto" style={{ padding: 0 }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--surface-border)" }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Champ</th>
                  {details.map((d) => (
                    <th key={d.id} className="text-center px-4 py-3">
                      <span className="badge-accent text-[11px]">{d.parser_preset}</span>
                      <p className="text-[10px] mt-1 tabular-nums" style={{ color: "var(--text-muted)" }}>{fmtDate(d.created_at)}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Score global */}
                <tr style={{ borderBottom: "2px solid var(--surface-border)", background: "var(--surface-card-alt)" }}>
                  <td className="px-4 py-3 font-bold text-sm" style={{ color: "var(--text-primary)" }}>Score global</td>
                  {details.map((d) => {
                    const s = d.global_score ?? 0;
                    const isBest = s === Math.max(...details.map((x) => x.global_score ?? 0));
                    return (
                      <td key={d.id} className="text-center px-4 py-3">
                        <span className={`text-base font-black tabular-nums ${scoreColor(s)} ${isBest ? "underline decoration-2 underline-offset-4" : ""}`}>{fmt(s)}</span>
                      </td>
                    );
                  })}
                </tr>

                {/* Par champ */}
                {allFields.map((field) => {
                  const scores = details.map((d) => d.field_summary?.[field] ?? null);
                  const valid = scores.filter((s): s is number => s != null);
                  const best = valid.length > 0 ? Math.max(...valid) : null;
                  return (
                    <tr key={field} style={{ borderBottom: "1px solid var(--surface-border)" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-secondary)" }}>{field}</td>
                      {scores.map((s, i) => (
                        <td key={i} className="text-center px-4 py-2.5">
                          {s != null ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold tabular-nums ${scoreBg(s)} ${scoreColor(s)} ${s === best && valid.length > 1 ? "ring-1 ring-emerald-400/40" : ""}`}>
                              {fmt(s)} {s === best && valid.length > 1 && <Check className="w-3 h-3" />}
                            </span>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* Temps */}
                <tr style={{ borderTop: "2px solid var(--surface-border)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>Temps (secondes)</td>
                  {details.map((d) => {
                    const t = (d.detail as ParserBenchmarkDetail | null)?.elapsed_seconds ?? 0;
                    const isFastest = t === Math.min(...details.map((x) => (x.detail as ParserBenchmarkDetail | null)?.elapsed_seconds ?? Infinity));
                    return (
                      <td key={d.id} className="text-center px-4 py-2.5">
                        <span className={`text-xs font-bold tabular-nums ${isFastest ? "text-emerald-400" : ""}`}
                          style={isFastest ? {} : { color: "var(--text-secondary)" }}>
                          {t.toFixed(1)}s{isFastest && details.length > 1 && " ⚡"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" /> ≥ 90%</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" /> 70–89%</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400" /> &lt; 70%</span>
            <span className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-400" /> Meilleur score</span>
          </div>
        </>
      )}
    </div>
  );
}