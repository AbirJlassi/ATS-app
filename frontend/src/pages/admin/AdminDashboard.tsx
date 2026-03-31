import { useEffect, useState } from "react";
import adminService from "@/services/adminService";
import { useAuthStore } from "@/store/authStore";
import type { User, Role, Statut } from "@/types";

const STATUT_CONFIG: Record<Statut, { label: string; badge: string }> = {
  EN_ATTENTE: { label: "En attente", badge: "badge-warning" },
  ACTIF:      { label: "Actif",      badge: "badge-success" },
  SUSPENDU:   { label: "Suspendu",   badge: "badge-danger"  },
};

const ROLE_CONFIG: Record<Role, { label: string }> = {
  CANDIDAT:       { label: "Candidat"  },
  RECRUTEUR:      { label: "Recruteur" },
  ADMINISTRATEUR: { label: "Admin"     },
};

export default function AdminDashboard() {
  const { user: me } = useAuthStore();
  const [users,        setUsers]        = useState<User[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [filterStatut, setFilterStatut] = useState<Statut | "TOUS">("TOUS");
  const [filterRole,   setFilterRole]   = useState<Role   | "TOUS">("TOUS");
  const [confirmDel,   setConfirmDel]   = useState<string | null>(null);
  const [actionId,     setActionId]     = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setUsers(await adminService.listUsers()); }
    catch { setError("Impossible de charger les utilisateurs."); }
    finally { setLoading(false); }
  };

  const act = async (id: string, fn: () => Promise<User | void>) => {
    setActionId(id);
    try { await fn(); await load(); }
    catch { setError("Une erreur est survenue."); }
    finally { setActionId(null); }
  };

  const filtered = users.filter((u) =>
    (filterStatut === "TOUS" || u.statut === filterStatut) &&
    (filterRole   === "TOUS" || u.role   === filterRole)
  );

  const counts = {
    EN_ATTENTE: users.filter((u) => u.statut === "EN_ATTENTE").length,
    ACTIF:      users.filter((u) => u.statut === "ACTIF").length,
    SUSPENDU:   users.filter((u) => u.statut === "SUSPENDU").length,
  };

  return (
    <div className="page animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">Administration</p>
          <h1 className="font-display text-3xl text-ink">Gestion des utilisateurs</h1>
        </div>
        <button onClick={load} className="btn-secondary btn-sm">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7a6 6 0 1 0 6-6 6 6 0 0 0-4.24 1.76" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M1 2v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {([
          { key: "EN_ATTENTE", label: "En attente", color: "text-warning" },
          { key: "ACTIF",      label: "Actifs",     color: "text-success" },
          { key: "SUSPENDU",   label: "Suspendus",  color: "text-danger"  },
        ] as const).map(({ key, label, color }) => (
          <button key={key} onClick={() => setFilterStatut(filterStatut === key ? "TOUS" : key)}
            className={`card text-left transition-all hover:shadow-card-hover hover:-translate-y-0.5 ${filterStatut === key ? "ring-2 ring-ink" : ""}`}>
            <p className={`text-3xl font-display ${color} mb-1`}>{counts[key]}</p>
            <p className="text-xs text-ink-muted uppercase tracking-wide">{label}</p>
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-6 flex justify-between">
          {error}<button onClick={() => setError(null)} className="text-danger/60 hover:text-danger">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input text-sm w-44 py-2"
          value={filterRole} onChange={(e) => setFilterRole(e.target.value as Role | "TOUS")}>
          <option value="TOUS">Tous les rôles</option>
          <option value="CANDIDAT">Candidat</option>
          <option value="RECRUTEUR">Recruteur</option>
          <option value="ADMINISTRATEUR">Admin</option>
        </select>
        <select className="input text-sm w-44 py-2"
          value={filterStatut} onChange={(e) => setFilterStatut(e.target.value as Statut | "TOUS")}>
          <option value="TOUS">Tous les statuts</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="ACTIF">Actif</option>
          <option value="SUSPENDU">Suspendu</option>
        </select>
        {(filterStatut !== "TOUS" || filterRole !== "TOUS") && (
          <button onClick={() => { setFilterStatut("TOUS"); setFilterRole("TOUS"); }}
            className="btn-ghost btn-sm text-ink-muted">Réinitialiser</button>
        )}
        <span className="ml-auto text-sm text-ink-muted self-center">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card empty-state text-ink-muted">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state">
          <div className="w-12 h-12 rounded-2xl bg-canvas flex items-center justify-center mb-3">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="8" stroke="#A8A8A4" strokeWidth="1.5"/>
              <path d="M10 6v4M10 13h.01" stroke="#A8A8A4" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-ink-secondary text-sm">Aucun utilisateur trouvé.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-4 text-xs font-medium text-ink-muted uppercase tracking-wide">Utilisateur</th>
                <th className="text-left px-4 py-4 text-xs font-medium text-ink-muted uppercase tracking-wide">Rôle</th>
                <th className="text-left px-4 py-4 text-xs font-medium text-ink-muted uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-4 text-xs font-medium text-ink-muted uppercase tracking-wide">Inscription</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-ink-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-canvas/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-accent/15 flex items-center justify-center text-accent-hover font-semibold text-xs shrink-0">
                        {u.prenom?.[0]?.toUpperCase() ?? u.email?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-medium text-ink">
                          {u.prenom && u.nom ? `${u.prenom} ${u.nom}` : "—"}
                        </p>
                        <p className="text-xs text-ink-muted">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {u.id === me?.id ? (
                      <span className="badge-neutral badge">{ROLE_CONFIG[u.role].label}</span>
                    ) : (
                      <select
                        className="text-xs border border-border rounded-lg px-2 py-1 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                        value={u.role} disabled={actionId === u.id}
                        onChange={(e) => act(u.id, () => adminService.updateUser(u.id, { role: e.target.value as Role }))}>
                        <option value="CANDIDAT">Candidat</option>
                        <option value="RECRUTEUR">Recruteur</option>
                        <option value="ADMINISTRATEUR">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className={STATUT_CONFIG[u.statut].badge}>
                      {STATUT_CONFIG[u.statut].label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-ink-muted">
                    {new Date(u.created_at).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 justify-end">
                      {u.statut === "EN_ATTENTE" && (
                        <button onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "ACTIF" }))}
                          disabled={actionId === u.id}
                          className="btn-sm bg-success-subtle text-success hover:bg-success/20 border-0">
                          Valider
                        </button>
                      )}
                      {u.statut === "ACTIF" && u.id !== me?.id && (
                        <button onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "SUSPENDU" }))}
                          disabled={actionId === u.id}
                          className="btn-sm bg-warning-subtle text-warning hover:bg-warning/20 border-0">
                          Suspendre
                        </button>
                      )}
                      {u.statut === "SUSPENDU" && (
                        <button onClick={() => act(u.id, () => adminService.updateUser(u.id, { statut: "ACTIF" }))}
                          disabled={actionId === u.id}
                          className="btn-sm bg-accent-subtle text-accent-hover hover:bg-accent/20 border-0">
                          Réactiver
                        </button>
                      )}
                      {u.id !== me?.id && (
                        <button onClick={() => setConfirmDel(u.id)}
                          disabled={actionId === u.id}
                          className="btn-sm bg-danger-subtle text-danger hover:bg-danger/20 border-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          Supprimer
                        </button>
                      )}
                      {actionId === u.id && <span className="text-xs text-ink-muted px-2 py-1">...</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-modal max-w-sm w-full p-6 animate-scale-in">
            <div className="w-10 h-10 rounded-xl bg-danger-subtle flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 6v4M9 13h.01M3 15L9 3l6 12H3Z" stroke="#E3445E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="font-display text-xl text-ink mb-1">Supprimer ce compte ?</h3>
            <p className="text-ink-secondary text-sm mb-6">Cette action est irréversible et supprimera toutes les données associées.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={() => { act(confirmDel, async () => { await adminService.deleteUser(confirmDel); }); setConfirmDel(null); }}
                className="btn-danger flex-1">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}