/**
 * AdminDashboard.tsx — Espace Administrateur FairHire
 * 
 * Tabs :
 *  - "users"     → Gestion complète des utilisateurs
 *  - "offres"    → Monitoring de toutes les offres publiées
 *  - "stats"     → Statistiques croisées plateforme
 *  - "benchmark" → Qualité IA (évaluateur du parser)
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, RefreshCw, Shield, Clock, UserCheck, UserX,
  Search, X, AlertTriangle, Trash2, ChevronDown,
  BarChart3, TrendingUp, Briefcase, ClipboardList,
  Building2, Globe, Star, Eye, ChevronRight, Calendar,
  Award, Layers, Activity, FlaskConical,
} from "lucide-react";
import adminService from "@/services/adminService";
import offreService from "@/services/offreService";
import { useAuthStore } from "@/store/authStore";
import type { User, Role, Statut, Offre } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";
import BenchmarkTab from "@/components/admin/BenchmarkTab";

type Tab = "users" | "offres" | "stats" | "benchmark";

/* ── Config statuts ── */
const STATUT_CONFIG: Record<Statut, { label: string; cls: string; dot: string }> = {
  EN_ATTENTE: { label: "En attente", cls: "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  ACTIF: { label: "Actif", cls: "bg-green-500/20 text-green-600 dark:text-green-300 border-green-500/30", dot: "bg-green-400" },
  SUSPENDU: { label: "Suspendu", cls: "bg-red-500/20 text-red-600 dark:text-red-300 border-red-500/30", dot: "bg-red-400" },
};

const ROLE_CONFIG: Record<Role, { label: string; color: string }> = {
  CANDIDAT: { label: "Candidat", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25" },
  RECRUTEUR: { label: "Recruteur", color: "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25" },
  ADMINISTRATEUR: { label: "Admin", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25" },
};

/* ── Composants utilitaires ── */
function KpiCard({ label, value, sub, icon, color, onClick, active }: {
  label: string; value: number | string; sub?: string;
  icon: React.ReactNode; color: string;
  onClick?: () => void; active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-5 flex items-center gap-4 transition-all duration-200
        ${color} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg" : ""}
        ${active ? "ring-2 ring-blue-500/50 shadow-lg" : ""}`}
    >
      <div className="w-11 h-11 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-700 dark:text-white/60 mt-0.5 truncate">{label}</p>
        {sub && <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{sub}</p>}
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-gray-400 dark:text-white/30 shrink-0" />}
    </Tag>
  );
}

function ProgressBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">{label}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">
          {value} <span className="text-gray-400 dark:text-slate-500 font-normal text-xs">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

/* ── Dashboard principal ── */
export default function AdminDashboard() {
  const { user: me } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<Tab>((searchParams.get("tab") as Tab) ?? "users");

  useEffect(() => {
    const t = searchParams.get("tab") as Tab;
    if (t && ["users", "offres", "stats", "benchmark"].includes(t)) setTab(t);
  }, [searchParams]);

  const switchTab = (t: Tab) => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  /* ── State users ── */
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<Statut | "TOUS">("TOUS");
  const [filterRole, setFilterRole] = useState<Role | "TOUS">("TOUS");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  /* ── State offres ── */
  const [offres, setOffres] = useState<Offre[]>([]);
  const [offresLoading, setOffresLoading] = useState(false);
  const [offreSearch, setOffreSearch] = useState("");
  const [offreDomaine, setOffreDomaine] = useState("Tous");
  const [selectedOffre, setSelectedOffre] = useState<Offre | null>(null);

  /* ── Load data ── */
  useEffect(() => { loadUsers(); }, []);
  useEffect(() => { if (tab === "offres" || tab === "stats") loadOffres(); }, [tab]);

  const loadUsers = async () => {
    try { setUsersLoading(true); setUsers(await adminService.listUsers()); }
    catch { setError("Impossible de charger les utilisateurs."); }
    finally { setUsersLoading(false); }
  };

  const loadOffres = async () => {
    if (offres.length > 0) return;
    try { setOffresLoading(true); setOffres(await offreService.listPublished()); }
    catch { /* silencieux */ }
    finally { setOffresLoading(false); }
  };

  const act = async (id: string, fn: () => Promise<User | void>) => {
    setActionId(id);
    try { await fn(); await loadUsers(); }
    catch { setError("Une erreur est survenue."); }
    finally { setActionId(null); }
  };

  /* ── Computed ── */
  const filteredUsers = users.filter((u) => {
    const matchStatut = filterStatut === "TOUS" || u.statut === filterStatut;
    const matchRole = filterRole === "TOUS" || u.role === filterRole;
    const matchSearch = !search || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    return matchStatut && matchRole && matchSearch;
  });

  const pendingUsers = users.filter((u) => u.statut === "EN_ATTENTE");

  const domaines = ["Tous", ...Array.from(new Set(offres.map((o) => o.domaine).filter(Boolean)))];

  const filteredOffres = offres.filter((o) => {
    const matchDomaine = offreDomaine === "Tous" || o.domaine === offreDomaine;
    const matchSearch = !offreSearch ||
      `${o.titre} ${o.recruteur_prenom} ${o.recruteur_nom} ${o.domaine}`.toLowerCase().includes(offreSearch.toLowerCase());
    return matchDomaine && matchSearch;
  });

  const counts = {
    EN_ATTENTE: users.filter((u) => u.statut === "EN_ATTENTE").length,
    ACTIF: users.filter((u) => u.statut === "ACTIF").length,
    SUSPENDU: users.filter((u) => u.statut === "SUSPENDU").length,
    candidats: users.filter((u) => u.role === "CANDIDAT").length,
    recruteurs: users.filter((u) => u.role === "RECRUTEUR").length,
    admins: users.filter((u) => u.role === "ADMINISTRATEUR").length,
  };

  const domaineStats = Array.from(
    offres.reduce((map, o) => {
      map.set(o.domaine, (map.get(o.domaine) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  const recruitersWithOffres = new Set(offres.map((o) => o.recruteur_id)).size;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <p className="text-xs font-semibold text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Administration
            </p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {tab === "users" && "Gestion des utilisateurs"}
              {tab === "offres" && "Monitoring des offres"}
              {tab === "stats" && "Statistiques plateforme"}
              {tab === "benchmark" && "Qualité IA"}
            </h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">
              {tab === "users" && `${users.length} compte${users.length > 1 ? "s" : ""} enregistré${users.length > 1 ? "s" : ""}${pendingUsers.length > 0 ? ` · ${pendingUsers.length} en attente` : ""}`}
              {tab === "offres" && `${offres.length} offre${offres.length > 1 ? "s" : ""} publiée${offres.length > 1 ? "s" : ""} · ${recruitersWithOffres} recruteur${recruitersWithOffres > 1 ? "s" : ""} actif${recruitersWithOffres > 1 ? "s" : ""}`}
              {tab === "stats" && "Vue d'ensemble de l'activité FairHire"}
              {tab === "benchmark" && "Évaluation des composants IA du parser"}
            </p>
          </div>
          <button
            onClick={() => { loadUsers(); if (tab !== "users") loadOffres(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 text-sm font-medium transition-all shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${usersLoading || offresLoading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-black/10 dark:border-white/10 w-fit mb-8">
          {([
            { key: "users", label: "Utilisateurs", icon: <Users className="w-4 h-4" />, badge: pendingUsers.length },
            { key: "offres", label: "Offres", icon: <Briefcase className="w-4 h-4" />, badge: 0 },
            { key: "stats", label: "Statistiques", icon: <BarChart3 className="w-4 h-4" />, badge: 0 },
            { key: "benchmark", label: "Qualité IA", icon: <FlaskConical className="w-4 h-4" />, badge: 0 },
          ] as const).map((t) => (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${tab === t.key
                ? "bg-blue-600 text-white shadow-md"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              {t.icon} {t.label}
              {t.badge > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? "bg-white/25 text-white" : "bg-amber-500 text-white"}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Erreur */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-between bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm rounded-xl px-4 py-3 mb-5">
              <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</span>
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ════════════════════════════════════════════
              TAB : UTILISATEURS
          ════════════════════════════════════════════ */}
          {tab === "users" && (
            <motion.div key="users" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* Alerte comptes en attente */}
              {pendingUsers.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-5 py-4 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-amber-600 dark:text-amber-300 text-sm">
                      {pendingUsers.length} compte{pendingUsers.length > 1 ? "s" : ""} en attente de validation
                    </p>
                    <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">
                      {pendingUsers.map((u) => [u.prenom, u.nom].filter(Boolean).join(" ") || u.email).join(", ")}
                    </p>
                  </div>
                  <button
                    onClick={() => setFilterStatut("EN_ATTENTE")}
                    className="ml-auto px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300 text-xs font-semibold hover:bg-amber-500/30 transition-all shrink-0"
                  >
                    Filtrer →
                  </button>
                </motion.div>
              )}

              {/* KPIs */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <KpiCard label="En attente" value={counts.EN_ATTENTE} icon={<Clock className="w-5 h-5 text-amber-400" />}
                  color="bg-amber-500/10 border-amber-500/20"
                  active={filterStatut === "EN_ATTENTE"}
                  onClick={() => setFilterStatut(filterStatut === "EN_ATTENTE" ? "TOUS" : "EN_ATTENTE")} />
                <KpiCard label="Actifs" value={counts.ACTIF} icon={<UserCheck className="w-5 h-5 text-green-400" />}
                  color="bg-green-500/10 border-green-500/20"
                  active={filterStatut === "ACTIF"}
                  onClick={() => setFilterStatut(filterStatut === "ACTIF" ? "TOUS" : "ACTIF")} />
                <KpiCard label="Suspendus" value={counts.SUSPENDU} icon={<UserX className="w-5 h-5 text-red-400" />}
                  color="bg-red-500/10 border-red-500/20"
                  active={filterStatut === "SUSPENDU"}
                  onClick={() => setFilterStatut(filterStatut === "SUSPENDU" ? "TOUS" : "SUSPENDU")} />
              </div>

              {/* Filtres */}
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                  <input type="search" placeholder="Rechercher un utilisateur…" value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-700 dark:text-slate-300 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all" />
                </div>
                <div className="relative">
                  <select value={filterRole} onChange={(e) => setFilterRole(e.target.value as Role | "TOUS")}
                    className="appearance-none pl-4 pr-9 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer dark:[color-scheme:dark]">
                    <option value="TOUS">Tous les rôles</option>
                    <option value="CANDIDAT">Candidat</option>
                    <option value="RECRUTEUR">Recruteur</option>
                    <option value="ADMINISTRATEUR">Admin</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500 pointer-events-none" />
                </div>
                {(filterStatut !== "TOUS" || filterRole !== "TOUS" || search) && (
                  <button onClick={() => { setFilterStatut("TOUS"); setFilterRole("TOUS"); setSearch(""); }}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 transition-all">
                    Réinitialiser
                  </button>
                )}
                <span className="ml-auto self-center text-sm text-gray-500 dark:text-slate-500 shrink-0">
                  {filteredUsers.length} résultat{filteredUsers.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Tableau */}
              {usersLoading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-gray-500 dark:text-slate-400">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  Chargement…
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-20 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                  <Users className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">Aucun utilisateur trouvé.</p>
                </div>
              ) : (
                <div className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_140px_140px_120px_190px] border-b border-black/10 dark:border-white/10">
                    {["Utilisateur", "Rôle", "Statut", "Inscription", "Actions"].map((h, i) => (
                      <div key={h} className={`px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide ${i === 4 ? "text-right" : ""}`}>
                        {h}
                      </div>
                    ))}
                  </div>

                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {filteredUsers.map((u, i) => {
                      const statut = STATUT_CONFIG[u.statut];
                      const role = ROLE_CONFIG[u.role];
                      return (
                        <motion.div key={u.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ duration: 0.15, delay: i * 0.02 }}
                          className={`grid grid-cols-[1fr_140px_140px_120px_190px] items-center transition-colors duration-150 group
                            ${u.statut === "EN_ATTENTE" ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-black/5 dark:hover:bg-white/5"}`}
                        >
                          {/* Utilisateur */}
                          <div className="px-5 py-4 flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border ${u.statut === "EN_ATTENTE"
                              ? "bg-amber-500/20 border-amber-500/30 text-amber-600 dark:text-amber-300"
                              : "bg-gradient-to-br from-blue-500/20 to-violet-500/20 border-black/10 dark:border-white/10 text-blue-600 dark:text-blue-400"
                              }`}>
                              {u.prenom?.[0]?.toUpperCase() ?? u.email?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {u.prenom && u.nom ? `${u.prenom} ${u.nom}` : "—"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{u.email}</p>
                              {u.role === "RECRUTEUR" && u.departement && (
                                <p className="text-xs text-violet-500 dark:text-violet-400 truncate flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-3 h-3" /> {u.departement}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Rôle */}
                          <div className="px-5 py-4">
                            {u.id === me?.id ? (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${role.color}`}>
                                <Shield className="w-3 h-3" /> {role.label}
                              </span>
                            ) : (
                              <div className="relative">
                                <select
                                  className="appearance-none pl-2.5 pr-7 py-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-xs text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer transition-all dark:[color-scheme:dark]"
                                  value={u.role} disabled={actionId === u.id}
                                  onChange={(e) => act(u.id, () => adminService.updateUser(u.id, { role: e.target.value as Role }))}>
                                  <option value="CANDIDAT">Candidat</option>
                                  <option value="RECRUTEUR">Recruteur</option>
                                  <option value="ADMINISTRATEUR">Admin</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 dark:text-slate-500 pointer-events-none" />
                              </div>
                            )}
                          </div>

                          {/* Statut */}
                          <div className="px-5 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statut.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statut.dot}`} />
                              {statut.label}
                            </span>
                          </div>

                          {/* Inscription */}
                          <div className="px-5 py-4 text-xs text-gray-500 dark:text-slate-500">
                            {new Date(u.created_at).toLocaleDateString("fr-FR")}
                          </div>

                          {/* Actions */}
                          <div className="px-5 py-4">
                            <div className="flex items-center gap-2 justify-end">
                              {actionId === u.id ? (
                                <div className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                              ) : (
                                <>
                                  {u.statut === "EN_ATTENTE" && (
                                    <button onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "ACTIF" }))}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-600 dark:text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-all">
                                      ✓ Valider
                                    </button>
                                  )}
                                  {u.statut === "ACTIF" && u.id !== me?.id && (
                                    <button onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "SUSPENDU" }))}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                                      Suspendre
                                    </button>
                                  )}
                                  {u.statut === "SUSPENDU" && (
                                    <button onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "ACTIF" }))}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all">
                                      Réactiver
                                    </button>
                                  )}
                                  {u.id !== me?.id && (
                                    <button onClick={() => setConfirmDel(u.id)}
                                      className="p-1.5 rounded-lg text-gray-400 dark:text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════
              TAB : OFFRES
          ════════════════════════════════════════════ */}
          {tab === "offres" && (
            <motion.div key="offres" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>

              {/* KPIs offres */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <KpiCard label="Offres publiées" value={offres.length}
                  icon={<Briefcase className="w-5 h-5 text-blue-400" />}
                  color="bg-blue-500/10 border-blue-500/20" />
                <KpiCard label="Recruteurs actifs" value={recruitersWithOffres}
                  icon={<Users className="w-5 h-5 text-violet-400" />}
                  color="bg-violet-500/10 border-violet-500/20" />
                <KpiCard label="Domaines couverts" value={domaineStats.length}
                  icon={<Globe className="w-5 h-5 text-emerald-400" />}
                  color="bg-emerald-500/10 border-emerald-500/20" />
              </div>

              {/* Filtres */}
              <div className="flex flex-wrap gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
                  <input type="search" placeholder="Rechercher une offre ou un recruteur…" value={offreSearch}
                    onChange={(e) => setOffreSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-700 dark:text-slate-300 placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all" />
                </div>
                <div className="relative">
                  <select value={offreDomaine} onChange={(e) => setOffreDomaine(e.target.value)}
                    className="appearance-none pl-4 pr-9 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-700 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 transition-all cursor-pointer dark:[color-scheme:dark]">
                    {domaines.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500 pointer-events-none" />
                </div>
                <span className="ml-auto self-center text-sm text-gray-500 dark:text-slate-500 shrink-0">
                  {filteredOffres.length} offre{filteredOffres.length > 1 ? "s" : ""}
                </span>
              </div>

              {offresLoading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-gray-500 dark:text-slate-400">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  Chargement des offres…
                </div>
              ) : filteredOffres.length === 0 ? (
                <div className="text-center py-20 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/10 dark:border-white/10">
                  <Briefcase className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-slate-400">Aucune offre trouvée.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOffres.map((o, i) => (
                    <motion.div key={o.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      onClick={() => setSelectedOffre(o)}
                      className={`bg-white/60 dark:bg-white/5 border rounded-2xl px-5 py-4 flex items-center gap-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 group backdrop-blur-sm ${selectedOffre?.id === o.id
                        ? "border-blue-500/40 bg-blue-500/5 dark:bg-blue-500/10 shadow-md"
                        : "border-black/10 dark:border-white/10 hover:border-blue-500/30"
                        }`}
                    >
                      {/* Domaine pill */}
                      <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-blue-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                            {o.domaine}
                          </span>
                          {o.annees_experience_min > 0 && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
                              <Award className="w-3 h-3" /> {o.annees_experience_min} an{o.annees_experience_min > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {o.titre}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                          {o.recruteur_prenom} {o.recruteur_nom}
                          {o.date_debut_souhaitee && (
                            <span className="ml-2 inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(o.date_debut_souhaitee).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Compétences */}
                      <div className="hidden lg:flex flex-wrap gap-1 max-w-[200px]">
                        {o.competences_requises.slice(0, 3).map((c) => (
                          <span key={c} className="px-2 py-0.5 rounded text-xs bg-black/5 dark:bg-white/5 text-gray-500 dark:text-slate-500 border border-black/10 dark:border-white/10">
                            {c}
                          </span>
                        ))}
                        {o.competences_requises.length > 3 && (
                          <span className="px-2 py-0.5 rounded text-xs bg-black/5 dark:bg-white/5 text-gray-400 dark:text-slate-600 border border-black/10 dark:border-white/10">
                            +{o.competences_requises.length - 3}
                          </span>
                        )}
                      </div>

                      <Eye className={`w-4 h-4 shrink-0 transition-colors ${selectedOffre?.id === o.id ? "text-blue-500" : "text-gray-400 dark:text-slate-600 opacity-0 group-hover:opacity-100"}`} />
                    </motion.div>
                  ))}
                </div>
              )}

            </motion.div>
          )}

          {/* ════════════════════════════════════════════
              TAB : STATISTIQUES
          ════════════════════════════════════════════ */}
          {tab === "stats" && (
            <motion.div key="stats" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-8">

              {/* Métriques globales */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Vue d'ensemble
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KpiCard label="Comptes total" value={users.length}
                    icon={<Users className="w-5 h-5 text-blue-400" />} color="bg-blue-500/10 border-blue-500/20" />
                  <KpiCard label="Candidats" value={counts.candidats}
                    icon={<UserCheck className="w-5 h-5 text-green-400" />} color="bg-green-500/10 border-green-500/20"
                    sub={`${users.length > 0 ? Math.round(counts.candidats / users.length * 100) : 0}% des comptes`} />
                  <KpiCard label="Recruteurs" value={counts.recruteurs}
                    icon={<Briefcase className="w-5 h-5 text-violet-400" />} color="bg-violet-500/10 border-violet-500/20"
                    sub={`${users.length > 0 ? Math.round(counts.recruteurs / users.length * 100) : 0}% des comptes`} />
                  <KpiCard label="Offres publiées" value={offres.length}
                    icon={<Globe className="w-5 h-5 text-amber-400" />} color="bg-amber-500/10 border-amber-500/20"
                    sub={`${recruitersWithOffres} recruteur${recruitersWithOffres > 1 ? "s" : ""} actif${recruitersWithOffres > 1 ? "s" : ""}`} />
                </div>
              </section>

              {/* Statuts + rôles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest">Statuts des comptes</p>
                  <ProgressBar label="Actifs" value={counts.ACTIF} total={users.length} color="bg-green-500" />
                  <ProgressBar label="En attente" value={counts.EN_ATTENTE} total={users.length} color="bg-amber-500" />
                  <ProgressBar label="Suspendus" value={counts.SUSPENDU} total={users.length} color="bg-red-500" />
                </section>

                <section className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 space-y-4 backdrop-blur-sm">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest">Répartition des rôles</p>
                  <ProgressBar label="Candidats" value={counts.candidats} total={users.length} color="bg-blue-500" />
                  <ProgressBar label="Recruteurs" value={counts.recruteurs} total={users.length} color="bg-violet-500" />
                  <ProgressBar label="Admins" value={counts.admins} total={users.length} color="bg-amber-500" />
                </section>
              </div>

              {/* Offres par domaine */}
              {offres.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> Offres par domaine
                  </p>
                  <div className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 space-y-3 backdrop-blur-sm">
                    {domaineStats.map(([domaine, count]) => (
                      <ProgressBar key={domaine} label={domaine} value={count} total={offres.length} color="bg-blue-500" />
                    ))}
                  </div>
                </section>
              )}

              {/* Recruteurs les plus actifs */}
              {offres.length > 0 && (
                <section>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Star className="w-3.5 h-3.5" /> Recruteurs les plus actifs
                  </p>
                  <div className="bg-white/60 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                    {Array.from(
                      offres.reduce((map, o) => {
                        const key = o.recruteur_id;
                        const existing = map.get(key) ?? { nom: `${o.recruteur_prenom ?? ""} ${o.recruteur_nom ?? ""}`.trim(), count: 0 };
                        map.set(key, { ...existing, count: existing.count + 1 });
                        return map;
                      }, new Map<string, { nom: string; count: number }>())
                    )
                      .sort((a, b) => b[1].count - a[1].count)
                      .slice(0, 5)
                      .map(([id, { nom, count }], i) => (
                        <div key={id} className={`flex items-center gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-black/5 dark:border-white/5" : ""}`}>
                          <span className="text-lg font-bold text-gray-300 dark:text-slate-600 w-6 text-center shrink-0">#{i + 1}</span>
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-black/10 dark:border-white/10 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-sm shrink-0">
                            {nom[0]?.toUpperCase() ?? "?"}
                          </div>
                          <p className="flex-1 font-medium text-gray-900 dark:text-white text-sm">{nom || "Recruteur"}</p>
                          <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            {count} offre{count > 1 ? "s" : ""}
                          </span>
                        </div>
                      ))
                    }
                  </div>
                </section>
              )}

              {/* Placeholder Sprint 4 */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" /> Activité temporelle
                </p>
                <div className="bg-black/5 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 rounded-2xl p-12 text-center">
                  <TrendingUp className="w-10 h-10 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400 font-medium">Graphiques temporels</p>
                  <p className="text-gray-400 dark:text-slate-600 text-sm mt-1">Inscriptions, candidatures et matchings par semaine — Sprint 4</p>
                  <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 text-xs font-medium">
                    <ClipboardList className="w-3.5 h-3.5" /> Sprint 4 — IA Générative & Admin avancé
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {/* ════════════════════════════════════════════
              TAB : BENCHMARK / QUALITÉ IA
          ════════════════════════════════════════════ */}
          {tab === "benchmark" && (
            <motion.div key="benchmark" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <BenchmarkTab />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ════════════════════════════════════════════
          SIDE PANEL — Détail offre (slide from right)
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedOffre && (
          <>
            {/* Backdrop léger */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
              onClick={() => setSelectedOffre(null)}
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg z-50 flex flex-col"
              style={{ background: "var(--surface-card, white)", borderLeft: "1px solid var(--surface-border, rgba(0,0,0,0.1))" }}
            >
              {/* Barre de statut colorée */}
              <div className="h-1 w-full bg-gradient-to-r from-blue-500 to-violet-500 shrink-0" />

              {/* Header */}
              <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-black/10 dark:border-white/10 shrink-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                      {selectedOffre.domaine}
                    </span>
                    {selectedOffre.annees_experience_min > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 bg-black/5 dark:bg-white/5 px-2.5 py-1 rounded-full border border-black/10 dark:border-white/10">
                        <Award className="w-3 h-3" /> {selectedOffre.annees_experience_min} an{selectedOffre.annees_experience_min > 1 ? "s" : ""} exp.
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">{selectedOffre.titre}</h2>
                </div>
                <button
                  onClick={() => setSelectedOffre(null)}
                  className="w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-gray-500 dark:text-slate-400 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Recruteur info */}
              <div className="px-6 py-4 flex items-center gap-3 border-b border-black/5 dark:border-white/5 shrink-0 bg-black/[0.02] dark:bg-white/[0.02]">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-black/10 dark:border-white/10 flex items-center justify-center text-violet-600 dark:text-violet-400 font-bold text-sm shrink-0">
                  {(selectedOffre.recruteur_prenom?.[0] ?? selectedOffre.recruteur_nom?.[0] ?? "R").toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-500">Publiée par</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {selectedOffre.recruteur_prenom} {selectedOffre.recruteur_nom}
                  </p>
                </div>
                {selectedOffre.date_debut_souhaitee && (
                  <div className="ml-auto text-right">
                    <p className="text-xs text-gray-500 dark:text-slate-500">Début souhaité</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date(selectedOffre.date_debut_souhaitee).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                )}
              </div>

              {/* Corps scrollable */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

                {/* Description */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-3">Description du poste</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {selectedOffre.description}
                  </p>
                </div>

                {/* Compétences */}
                {selectedOffre.competences_requises.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-3">
                      Compétences requises
                      <span className="ml-2 text-blue-500 dark:text-blue-400 font-bold normal-case">({selectedOffre.competences_requises.length})</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedOffre.competences_requises.map((c) => (
                        <span key={c} className="px-3 py-1.5 rounded-xl text-sm font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Récapitulatif méta */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-black/10 dark:border-white/10">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center mb-3">
                      <Award className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-0.5">Expérience min.</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {selectedOffre.annees_experience_min > 0
                        ? `${selectedOffre.annees_experience_min} an${selectedOffre.annees_experience_min > 1 ? "s" : ""}`
                        : "Non spécifiée"}
                    </p>
                  </div>
                  <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-4 border border-black/10 dark:border-white/10">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mb-3">
                      <Calendar className="w-4 h-4 text-violet-500" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-500 mb-0.5">Date de début</p>
                    <p className="text-base font-bold text-gray-900 dark:text-white">
                      {selectedOffre.date_debut_souhaitee
                        ? new Date(selectedOffre.date_debut_souhaitee).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
                        : "Non spécifiée"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Footer navigation */}
              <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 shrink-0">
                <div className="flex items-center justify-between">
                  {/* Navigation entre offres */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const idx = filteredOffres.findIndex((o) => o.id === selectedOffre.id);
                        if (idx > 0) setSelectedOffre(filteredOffres[idx - 1]);
                      }}
                      disabled={filteredOffres.findIndex((o) => o.id === selectedOffre.id) === 0}
                      className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      ← Précédente
                    </button>
                    <button
                      onClick={() => {
                        const idx = filteredOffres.findIndex((o) => o.id === selectedOffre.id);
                        if (idx < filteredOffres.length - 1) setSelectedOffre(filteredOffres[idx + 1]);
                      }}
                      disabled={filteredOffres.findIndex((o) => o.id === selectedOffre.id) === filteredOffres.length - 1}
                      className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-slate-400 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      Suivante →
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-slate-600">
                    {filteredOffres.findIndex((o) => o.id === selectedOffre.id) + 1} / {filteredOffres.length}
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal suppression ── */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => setConfirmDel(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25 }}
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.5)] max-w-sm w-full p-7"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">Supprimer ce compte ?</h3>
              <p className="text-gray-500 dark:text-slate-400 text-sm text-center mb-7">
                Action irréversible. Toutes les données associées seront supprimées.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDel(null)}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                  Annuler
                </button>
                <button onClick={() => { act(confirmDel, async () => { await adminService.deleteUser(confirmDel); }); setConfirmDel(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-all flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" /> Supprimer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}