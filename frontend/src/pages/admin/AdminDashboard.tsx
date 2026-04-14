/**
 * AdminDashboard.tsx — Gestion des utilisateurs (Administrateur)
 * Fond sombre premium via DashboardLayout, tableau avec glassmorphism,
 * stats cliquables, filtres et modal de confirmation suppression.
 *
 * Onglets :
 *  - "users"  → Gestion des utilisateurs (tableau complet)
 *  - "stats"  → Statistiques plateforme (Sprint 4)
 *
 * La Sidebar génère des liens ?tab=users et ?tab=stats,
 * useSearchParams synchronise l'onglet actif.
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, RefreshCw, Shield, Clock, UserCheck, UserX,
  Search, X, AlertTriangle, Trash2, ChevronDown,
  BarChart3, TrendingUp, Briefcase, ClipboardList,
} from "lucide-react";
import adminService from "@/services/adminService";
import { useAuthStore } from "@/store/authStore";
import type { User, Role, Statut } from "@/types";
import DashboardLayout from "@/components/layout/DashboardLayout";

/* ── Types ── */
type Tab = "users" | "stats";

/* ── Config statuts ── */
const STATUT_CONFIG: Record<Statut, { label: string; cls: string; dot: string }> = {
  EN_ATTENTE: { label: "En attente", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  ACTIF: { label: "Actif", cls: "bg-green-500/20 text-green-300 border-green-500/30", dot: "bg-green-400" },
  SUSPENDU: { label: "Suspendu", cls: "bg-red-500/20 text-red-300 border-red-500/30", dot: "bg-red-400" },
};

const ROLE_CONFIG: Record<Role, { label: string }> = {
  CANDIDAT: { label: "Candidat" },
  RECRUTEUR: { label: "Recruteur" },
  ADMINISTRATEUR: { label: "Admin" },
};

/* ── Carte statistique cliquable ── */
function StatCard({
  label, value, icon, color, active, onClick,
}: {
  label: string; value: number; icon: React.ReactNode;
  color: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border p-5 text-left transition-all duration-200 flex items-start gap-4
        ${active ? "ring-2 ring-blue-500/50 " : "hover:border-black/20 dark:border-white/20 hover:bg-black/5 dark:bg-white/5"} ${color}`}
    >
      <div className="w-10 h-10 rounded-xl bg-black/10 dark:bg-white/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-900 dark:text-white/50 mt-0.5">{label}</p>
      </div>
    </button>
  );
}

/* ── Carte stat plateforme (onglet Stats) ── */
function PlatformStatCard({
  label, value, icon, sublabel,
}: {
  label: string; value: string | number; icon: React.ReactNode; sublabel?: string;
}) {
  return (
    <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">{label}</p>
        {sublabel && <p className="text-xs text-gray-500 dark:text-slate-600 mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

/* ── Composant principal ── */
export default function AdminDashboard() {
  const { user: me } = useAuthStore();

  /* ── Synchronisation onglet ↔ Sidebar (?tab=) ── */
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    (searchParams.get("tab") as Tab) ?? "users"
  );
  useEffect(() => {
    const t = searchParams.get("tab") as Tab;
    if (t) setTab(t);
  }, [searchParams]);

  /* ── État utilisateurs ── */
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatut, setFilterStatut] = useState<Statut | "TOUS">("TOUS");
  const [filterRole, setFilterRole] = useState<Role | "TOUS">("TOUS");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setUsers(await adminService.listUsers()); }
    catch { setError("Impossible de charger les utilisateurs."); }
    finally { setLoading(false); }
  };

  /* Exécuter une action admin et recharger */
  const act = async (id: string, fn: () => Promise<User | void>) => {
    setActionId(id);
    try { await fn(); await load(); }
    catch { setError("Une erreur est survenue."); }
    finally { setActionId(null); }
  };

  /* Filtres combinés */
  const filtered = users.filter((u) => {
    const matchStatut = filterStatut === "TOUS" || u.statut === filterStatut;
    const matchRole = filterRole === "TOUS" || u.role === filterRole;
    const matchSearch = search === "" ||
      `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    return matchStatut && matchRole && matchSearch;
  });

  /* Stats globales */
  const counts = {
    EN_ATTENTE: users.filter((u) => u.statut === "EN_ATTENTE").length,
    ACTIF: users.filter((u) => u.statut === "ACTIF").length,
    SUSPENDU: users.filter((u) => u.statut === "SUSPENDU").length,
    candidats: users.filter((u) => u.role === "CANDIDAT").length,
    recruteurs: users.filter((u) => u.role === "RECRUTEUR").length,
    admins: users.filter((u) => u.role === "ADMINISTRATEUR").length,
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Administration</p>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {tab === "users" ? "Gestion des utilisateurs" : "Statistiques plateforme"}
            </h1>
            <p className="text-gray-500 dark:text-gray-600 dark:text-slate-400 text-sm mt-1">
              {tab === "users"
                ? `${users.length} compte${users.length > 1 ? "s" : ""} enregistré${users.length > 1 ? "s" : ""}`
                : "Vue d'ensemble de l'activité FairHire"
              }
            </p>
          </div>
          {tab === "users" && (
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 text-gray-600 dark:text-slate-300 text-sm font-medium transition-all duration-200 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </button>
          )}
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-1 bg-black/5 dark:bg-white/5 rounded-xl p-1 border border-black/10 dark:border-white/10 w-fit mb-8">
          {([
            { key: "users", label: "Utilisateurs", icon: <Users className="w-4 h-4" /> },
            { key: "stats", label: "Statistiques", icon: <BarChart3 className="w-4 h-4" /> },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${tab === t.key
                ? "bg-blue-600 text-gray-900 dark:text-white shadow-md"
                : "text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-white hover:bg-black/5 dark:bg-white/5"
                }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Erreur ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center justify-between bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-5"
            >
              <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</span>
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════
            TAB : UTILISATEURS
        ════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {tab === "users" && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            >
              {/* Cartes stats filtrables */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <StatCard
                  label="En attente" value={counts.EN_ATTENTE}
                  icon={<Clock className="w-5 h-5 text-amber-300" />}
                  color="bg-amber-500/10 border-amber-500/20"
                  active={filterStatut === "EN_ATTENTE"}
                  onClick={() => setFilterStatut(filterStatut === "EN_ATTENTE" ? "TOUS" : "EN_ATTENTE")}
                />
                <StatCard
                  label="Actifs" value={counts.ACTIF}
                  icon={<UserCheck className="w-5 h-5 text-green-300" />}
                  color="bg-green-500/10 border-green-500/20"
                  active={filterStatut === "ACTIF"}
                  onClick={() => setFilterStatut(filterStatut === "ACTIF" ? "TOUS" : "ACTIF")}
                />
                <StatCard
                  label="Suspendus" value={counts.SUSPENDU}
                  icon={<UserX className="w-5 h-5 text-red-300" />}
                  color="bg-red-500/10 border-red-500/20"
                  active={filterStatut === "SUSPENDU"}
                  onClick={() => setFilterStatut(filterStatut === "SUSPENDU" ? "TOUS" : "SUSPENDU")}
                />
              </div>

              {/* Barre de filtres */}
              <div className="flex flex-wrap gap-3 mb-6">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-slate-500" />
                  <input
                    type="search"
                    placeholder="Rechercher un utilisateur…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-600 dark:text-slate-300 placeholder:text-gray-500 dark:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value as Role | "TOUS")}
                    className="appearance-none pl-4 pr-9 py-2.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl text-sm text-gray-600 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                  >
                    <option value="TOUS">Tous les rôles</option>
                    <option value="CANDIDAT">Candidat</option>
                    <option value="RECRUTEUR">Recruteur</option>
                    <option value="ADMINISTRATEUR">Admin</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 dark:text-slate-500 pointer-events-none" />
                </div>
                {(filterStatut !== "TOUS" || filterRole !== "TOUS" || search) && (
                  <button
                    onClick={() => { setFilterStatut("TOUS"); setFilterRole("TOUS"); setSearch(""); }}
                    className="px-4 py-2.5 rounded-xl text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 transition-all"
                  >
                    Réinitialiser
                  </button>
                )}
                <span className="ml-auto self-center text-sm text-gray-500 dark:text-slate-500 shrink-0">
                  {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
                </span>
              </div>

              {/* Tableau */}
              {loading ? (
                <div className="flex items-center justify-center gap-3 py-20 text-gray-600 dark:text-slate-400">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  Chargement des utilisateurs...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-20 bg-black/3 dark:bg-white/3 rounded-2xl border border-black/10 dark:border-white/10">
                  <Users className="w-10 h-10 text-gray-500 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-slate-400">Aucun utilisateur trouvé.</p>
                </div>
              ) : (
                <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-[1fr_130px_130px_120px_180px] gap-0 border-b border-black/10 dark:border-white/10">
                    {["Utilisateur", "Rôle", "Statut", "Inscription", "Actions"].map((h, i) => (
                      <div key={h} className={`px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-wide ${i === 4 ? "text-right" : ""}`}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {/* Lignes */}
                  <div className="divide-y divide-black/5 dark:divide-white/5">
                    {filtered.map((u, i) => {
                      const statut = STATUT_CONFIG[u.statut];
                      return (
                        <motion.div
                          key={u.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ duration: 0.2, delay: i * 0.03 }}
                          className="grid grid-cols-[1fr_130px_130px_120px_180px] gap-0 items-center hover:bg-black/5 dark:bg-white/5 transition-colors duration-150 group"
                        >
                          {/* Utilisateur */}
                          <div className="px-5 py-4 flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-black/10 dark:border-white/10 flex items-center justify-center text-blue-300 font-bold text-sm shrink-0">
                              {u.prenom?.[0]?.toUpperCase() ?? u.email?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {u.prenom && u.nom ? `${u.prenom} ${u.nom}` : "—"}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{u.email}</p>
                            </div>
                          </div>

                          {/* Rôle */}
                          <div className="px-5 py-4">
                            {u.id === me?.id ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                <Shield className="w-3 h-3" /> {ROLE_CONFIG[u.role].label}
                              </span>
                            ) : (
                              <div className="relative">
                                <select
                                  className="appearance-none pl-2.5 pr-7 py-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-slate-300 focus:outline-none focus:border-blue-500/50 cursor-pointer transition-all"
                                  value={u.role}
                                  disabled={actionId === u.id}
                                  onChange={(e) => act(u.id, () => adminService.updateUser(u.id, { role: e.target.value as Role }))}
                                >
                                  <option value="CANDIDAT">Candidat</option>
                                  <option value="RECRUTEUR">Recruteur</option>
                                  <option value="ADMINISTRATEUR">Admin</option>
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 dark:text-slate-500 pointer-events-none" />
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

                          {/* Date inscription */}
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
                                    <button
                                      onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "ACTIF" }))}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-all"
                                    >
                                      Valider
                                    </button>
                                  )}
                                  {u.statut === "ACTIF" && u.id !== me?.id && (
                                    <button
                                      onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "SUSPENDU" }))}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
                                    >
                                      Suspendre
                                    </button>
                                  )}
                                  {u.statut === "SUSPENDU" && (
                                    <button
                                      onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "ACTIF" }))}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 transition-all"
                                    >
                                      Réactiver
                                    </button>
                                  )}
                                  {u.id !== me?.id && (
                                    <button
                                      onClick={() => setConfirmDel(u.id)}
                                      className="p-1.5 rounded-lg text-gray-500 dark:text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                    >
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
              TAB : STATISTIQUES
          ════════════════════════════════════════════ */}
          {tab === "stats" && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
              className="space-y-8"
            >
              {/* Compteurs utilisateurs */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4">
                  Utilisateurs
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <PlatformStatCard
                    label="Total comptes"
                    value={users.length}
                    icon={<Users className="w-6 h-6 text-blue-400" />}
                  />
                  <PlatformStatCard
                    label="Candidats actifs"
                    value={counts.candidats}
                    icon={<UserCheck className="w-6 h-6 text-green-400" />}
                    sublabel="Rôle CANDIDAT"
                  />
                  <PlatformStatCard
                    label="Recruteurs actifs"
                    value={counts.recruteurs}
                    icon={<Briefcase className="w-6 h-6 text-violet-400" />}
                    sublabel="Rôle RECRUTEUR"
                  />
                </div>
              </section>

              {/* Répartition statuts */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4">
                  Statuts des comptes
                </p>
                <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl p-6 space-y-4">
                  {(["ACTIF", "EN_ATTENTE", "SUSPENDU"] as Statut[]).map((s) => {
                    const count = users.filter((u) => u.statut === s).length;
                    const pct = users.length ? Math.round((count / users.length) * 100) : 0;
                    const cfg = STATUT_CONFIG[s];
                    return (
                      <div key={s}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{count} <span className="text-gray-500 dark:text-slate-500 font-normal text-xs">({pct}%)</span></span>
                        </div>
                        <div className="h-2 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                            className={`h-full rounded-full ${s === "ACTIF" ? "bg-green-500" :
                              s === "EN_ATTENTE" ? "bg-amber-500" : "bg-red-500"
                              }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Placeholder Sprint 4 */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-500 uppercase tracking-widest mb-4">
                  Activité plateforme
                </p>
                <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 border-dashed rounded-2xl p-12 text-center">
                  <TrendingUp className="w-10 h-10 text-gray-500 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-600 dark:text-slate-400 font-medium">Graphiques d'activité</p>
                  <p className="text-gray-400 dark:text-gray-500 dark:text-slate-600 text-sm mt-1">Disponible au Sprint 4 — offres publiées, candidatures reçues, scores de matching.</p>
                  <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                    <ClipboardList className="w-3.5 h-3.5" />
                    Sprint 4 — IA Générative & Admin avancé
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Modal confirmation suppression ── */}
      <AnimatePresence>
        {confirmDel && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-white dark:bg-slate-900 border border-black/10 dark:border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.5)] max-w-sm w-full p-7"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">Supprimer ce compte ?</h3>
              <p className="text-gray-500 dark:text-gray-600 dark:text-slate-400 text-sm text-center mb-7">
                Cette action est irréversible et supprimera toutes les données associées à cet utilisateur.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDel(null)}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-gray-600 dark:text-slate-300 text-sm font-medium hover:bg-black/10 dark:bg-white/10 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    act(confirmDel, async () => { await adminService.deleteUser(confirmDel); });
                    setConfirmDel(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-gray-900 dark:text-white text-sm font-semibold hover:bg-red-500 transition-all flex items-center justify-center gap-2"
                >
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