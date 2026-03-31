import { useEffect, useState } from "react";
import offreService from "@/services/offreService";
import candidatureService from "@/services/candidatureService";
import { useAuthStore } from "@/store/authStore";
import type { Offre, OffreCreate, StatutOffre, Candidature, StatutCandidature } from "@/types";

const DOMAINES = ["Informatique", "Finance", "Marketing", "RH", "Commercial", "Ingénierie", "Autre"];

const STATUT_OFFRE: Record<StatutOffre, { label: string; badge: string }> = {
  PUBLIEE:   { label: "Publiée",   badge: "badge-success" },
  BROUILLON: { label: "Brouillon", badge: "badge-neutral" },
  FERMEE:    { label: "Fermée",    badge: "badge-danger"  },
};

const STATUT_CAND: Record<StatutCandidature, { label: string; badge: string }> = {
  SOUMISE:         { label: "Soumise",   badge: "badge-accent"  },
  EN_COURS_EXAMEN: { label: "En cours",  badge: "badge-warning" },
  ACCEPTEE:        { label: "Acceptée",  badge: "badge-success" },
  REFUSEE:         { label: "Refusée",   badge: "badge-danger"  },
};

type Tab = "mes-offres" | "candidatures" | "marche";

function OffreForm({ initial, onSubmit, onCancel, loading }: { initial?: Partial<OffreCreate>; onSubmit: (d: OffreCreate) => void; onCancel: () => void; loading: boolean }) {
  const [form, setForm] = useState<OffreCreate>({ titre: initial?.titre ?? "", description: initial?.description ?? "", domaine: initial?.domaine ?? "", competences_requises: initial?.competences_requises ?? [], annees_experience_min: initial?.annees_experience_min ?? 0, date_debut_souhaitee: initial?.date_debut_souhaitee ?? "" });
  const [ci, setCi] = useState("");
  const addC = () => { const v = ci.trim(); if (v && !form.competences_requises.includes(v)) setForm((f) => ({ ...f, competences_requises: [...f.competences_requises, v] })); setCi(""); };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs text-ink-muted mb-1.5 uppercase tracking-wide">Titre du poste *</label>
          <input className="input" value={form.titre} onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))} placeholder="ex: Développeur Full Stack" required />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1.5 uppercase tracking-wide">Domaine *</label>
          <select className="input" value={form.domaine} onChange={(e) => setForm((f) => ({ ...f, domaine: e.target.value }))} required>
            <option value="">Sélectionner</option>
            {DOMAINES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1.5 uppercase tracking-wide">Expérience min. (ans)</label>
          <input type="number" min={0} max={20} className="input" value={form.annees_experience_min} onChange={(e) => setForm((f) => ({ ...f, annees_experience_min: +e.target.value }))} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-ink-muted mb-1.5 uppercase tracking-wide">Description *</label>
          <textarea className="input min-h-[90px] resize-y" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Décrivez le poste et les responsabilités..." required />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1.5 uppercase tracking-wide">Date de début</label>
          <input type="date" className="input" value={form.date_debut_souhaitee ?? ""} onChange={(e) => setForm((f) => ({ ...f, date_debut_souhaitee: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-ink-muted mb-1.5 uppercase tracking-wide">Compétences requises</label>
          <div className="flex gap-2">
            <input className="input" value={ci} onChange={(e) => setCi(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addC(); } }} placeholder="React, Python..." />
            <button type="button" onClick={addC} className="btn-secondary btn-sm whitespace-nowrap">+ Ajouter</button>
          </div>
        </div>
        {form.competences_requises.length > 0 && (
          <div className="col-span-2 flex flex-wrap gap-1.5">
            {form.competences_requises.map((c) => (
              <span key={c} className="badge-accent badge cursor-pointer" onClick={() => setForm((f) => ({ ...f, competences_requises: f.competences_requises.filter((x) => x !== c) }))}>
                {c} ✕
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">Annuler</button>
        <button type="submit" disabled={loading} className="btn-primary flex-1">{loading ? "Enregistrement..." : "Publier l'offre →"}</button>
      </div>
    </form>
  );
}

export default function RecruiterDashboard() {
  const { user } = useAuthStore();
  const [tab, setTab]               = useState<Tab>("mes-offres");
  const [mesOffres, setMesOffres]   = useState<Offre[]>([]);
  const [autres, setAutres]         = useState<Offre[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [editOffre, setEditOffre]   = useState<Offre | null>(null);
  const [actionLoading, setAL]      = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [selOffreId, setSelOffreId] = useState<string | null>(null);
  const [cands, setCands]           = useState<Candidature[]>([]);
  const [candLoading, setCL]        = useState(false);

  useEffect(() => { fetchMes(); fetchAutres(); }, []);

  const fetchMes = async () => { try { setLoading(true); setMesOffres(await offreService.mesOffres()); } catch { setError("Impossible de charger vos offres."); } finally { setLoading(false); } };
  const fetchAutres = async () => { try { const all = await offreService.listPublished(); setAutres(all.filter((o) => o.recruteur_id !== user?.id)); } catch { /* silent */ } };

  const fetchCands = async (id: string) => {
    setCL(true); setSelOffreId(id); setTab("candidatures");
    try { setCands(await candidatureService.candidaturesOffre(id)); } catch { setError("Impossible de charger les candidatures."); } finally { setCL(false); }
  };

  const handleCreate = async (d: OffreCreate) => { setAL(true); try { const o = await offreService.create(d); setMesOffres((p) => [o, ...p]); setShowForm(false); } catch { setError("Erreur."); } finally { setAL(false); } };
  const handleUpdate = async (d: OffreCreate) => { if (!editOffre) return; setAL(true); try { const u = await offreService.update(editOffre.id, d); setMesOffres((p) => p.map((o) => (o.id === editOffre.id ? u : o))); setEditOffre(null); } catch { setError("Erreur."); } finally { setAL(false); } };
  const handleDelete = async (id: string) => { setAL(true); try { await offreService.delete(id); setMesOffres((p) => p.filter((o) => o.id !== id)); } catch { setError("Erreur."); } finally { setAL(false); setConfirmDel(null); } };
  const handleFermer = async (id: string) => { try { const u = await offreService.update(id, { statut: "FERMEE" }); setMesOffres((p) => p.map((o) => (o.id === id ? u : o))); } catch { setError("Erreur."); } };
  const handleCandStatut = async (cId: string, s: StatutCandidature) => { try { const u = await candidatureService.updateStatut(cId, s); setCands((p) => p.map((c) => (c.id === cId ? u : c))); } catch { setError("Erreur."); } };

  const selOffre = mesOffres.find((o) => o.id === selOffreId);

  return (
    <div className="page animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">Espace Recruteur</p>
          <h1 className="font-display text-3xl text-ink">Bonjour, {user?.prenom ?? user?.email?.split("@")[0]} 👋</h1>
        </div>
        {tab === "mes-offres" && !showForm && !editOffre && (
          <button onClick={() => setShowForm(true)} className="btn-primary">+ Publier une offre</button>
        )}
      </div>

      <div className="tabs mb-6">
        <button className={tab === "mes-offres" ? "tab-active" : "tab"} onClick={() => setTab("mes-offres")}>
          Mes offres <span className="ml-1 badge-neutral badge">{mesOffres.length}</span>
        </button>
        <button className={tab === "candidatures" ? "tab-active" : "tab"} onClick={() => setTab("candidatures")}>
          Candidatures reçues
        </button>
        <button className={tab === "marche" ? "tab-active" : "tab"} onClick={() => { setTab("marche"); fetchAutres(); }}>
          Marché <span className="ml-1 badge-neutral badge">{autres.length}</span>
        </button>
      </div>

      {error && <div className="bg-danger-subtle border border-danger/20 text-danger text-sm rounded-xl px-4 py-3 mb-6 flex justify-between">{error}<button onClick={() => setError(null)}>✕</button></div>}

      {/* Mes offres */}
      {tab === "mes-offres" && (
        <>
          {showForm && <div className="card mb-6"><p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-4">Nouvelle offre</p><OffreForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} loading={actionLoading} /></div>}
          {editOffre && (
  <div className="card mb-6">
    <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-4">Modifier l'offre</p>
    <OffreForm
      initial={{
        ...editOffre,
        date_debut_souhaitee: editOffre.date_debut_souhaitee ?? undefined,
      }}
      onSubmit={handleUpdate}
      onCancel={() => setEditOffre(null)}
      loading={actionLoading}
    />
  </div>
)}
          {loading ? <div className="empty-state text-ink-muted">Chargement...</div>
          : mesOffres.length === 0 ? (
            <div className="empty-state">
              <div className="w-12 h-12 rounded-2xl bg-canvas flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" stroke="#A8A8A4" strokeWidth="1.5"/><path d="M7 10h6M7 7h6M7 13h4" stroke="#A8A8A4" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <p className="text-ink-secondary text-sm mb-3">Aucune offre publiée.</p>
              <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">Publier ma première offre</button>
            </div>
          ) : (
            <div className="space-y-4">
              {mesOffres.map((o) => (
                <div key={o.id} className="card hover:shadow-card-hover transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={STATUT_OFFRE[o.statut].badge}>{STATUT_OFFRE[o.statut].label}</span>
                        <span className="badge-neutral badge">{o.domaine}</span>
                      </div>
                      <h3 className="font-semibold text-ink text-lg mb-1">{o.titre}</h3>
                      <p className="text-ink-secondary text-sm line-clamp-2 mb-3">{o.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {o.competences_requises.slice(0, 4).map((c) => <span key={c} className="badge-neutral badge">{c}</span>)}
                        {o.competences_requises.length > 4 && <span className="badge-neutral badge">+{o.competences_requises.length - 4}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button onClick={() => fetchCands(o.id)} className="btn-secondary btn-sm">👥 Candidatures</button>
                      <button onClick={() => setEditOffre(o)} className="btn-secondary btn-sm">✏️ Modifier</button>
                      {o.statut === "PUBLIEE" && <button onClick={() => handleFermer(o.id)} className="btn-sm bg-warning-subtle text-warning border-0 hover:bg-warning/20">🔒 Fermer</button>}
                      <button onClick={() => setConfirmDel(o.id)} className="btn-sm bg-danger-subtle text-danger border-0 hover:bg-danger/20">🗑 Supprimer</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Candidatures */}
      {tab === "candidatures" && (
        <>
          <div className="card mb-4 flex items-center gap-4">
            <label className="text-xs text-ink-muted uppercase tracking-wide whitespace-nowrap">Offre :</label>
            <select className="input text-sm" value={selOffreId ?? ""} onChange={(e) => e.target.value && fetchCands(e.target.value)}>
              <option value="">Sélectionner une offre</option>
              {mesOffres.map((o) => <option key={o.id} value={o.id}>{o.titre}</option>)}
            </select>
          </div>
          {!selOffreId ? (
            <div className="empty-state text-ink-muted text-sm">Sélectionnez une offre pour voir ses candidatures.</div>
          ) : candLoading ? (
            <div className="empty-state text-ink-muted">Chargement...</div>
          ) : cands.length === 0 ? (
            <div className="empty-state">
              <p className="text-ink-secondary text-sm">Aucune candidature pour <strong>{selOffre?.titre}</strong>.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-ink-muted mb-4"><strong>{cands.length}</strong> candidature{cands.length > 1 ? "s" : ""} pour <strong>{selOffre?.titre}</strong></p>
              <div className="space-y-3">
                {cands.map((c) => (
                  <div key={c.id} className="card flex items-center justify-between gap-4 hover:shadow-card-hover transition-all">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent-hover font-semibold text-sm shrink-0">
                        {c.candidat_prenom?.[0]?.toUpperCase() ?? c.candidat_email?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{c.candidat_prenom} {c.candidat_nom}</p>
                        <p className="text-xs text-ink-muted">{c.candidat_email} · {c.cv_nom_fichier} · {new Date(c.date_postulation).toLocaleDateString("fr-FR")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={STATUT_CAND[c.statut].badge}>{STATUT_CAND[c.statut].label}</span>
                      <select className="text-xs border border-border rounded-lg px-2 py-1.5 bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                        value={c.statut} onChange={(e) => handleCandStatut(c.id, e.target.value as StatutCandidature)}>
                        <option value="SOUMISE">Soumise</option>
                        <option value="EN_COURS_EXAMEN">En cours</option>
                        <option value="ACCEPTEE">Acceptée</option>
                        <option value="REFUSEE">Refusée</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Marché */}
      {tab === "marche" && (
        <>
          <p className="text-sm text-ink-muted mb-6">Offres publiées par les autres recruteurs de la plateforme.</p>
          {autres.length === 0 ? (
            <div className="empty-state text-ink-secondary text-sm">Aucune autre offre publiée.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {autres.map((o) => (
                <div key={o.id} className="card-hover">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="badge-accent badge">{o.domaine}</span>
                  </div>
                  <h3 className="font-semibold text-ink mb-1">{o.titre}</h3>
                  {(o.recruteur_prenom || o.recruteur_nom) && <p className="text-xs text-ink-muted mb-2">{o.recruteur_prenom} {o.recruteur_nom}</p>}
                  <p className="text-ink-secondary text-sm line-clamp-3 mb-3">{o.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.competences_requises.slice(0, 3).map((c) => <span key={c} className="badge-neutral badge">{c}</span>)}
                    {o.competences_requises.length > 3 && <span className="badge-neutral badge">+{o.competences_requises.length - 3}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal delete */}
      {confirmDel && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-fade-in">
          <div className="bg-surface rounded-2xl shadow-modal max-w-sm w-full p-6 animate-scale-in">
            <div className="w-10 h-10 rounded-xl bg-danger-subtle flex items-center justify-center mb-4">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 6v4M9 13h.01M3 15L9 3l6 12H3Z" stroke="#E3445E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <h3 className="font-display text-xl text-ink mb-1">Supprimer cette offre ?</h3>
            <p className="text-ink-secondary text-sm mb-6">Les candidatures associées seront également supprimées.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={() => handleDelete(confirmDel)} className="btn-danger flex-1">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}