import { useEffect, useState } from "react";
import offreService from "@/services/offreService";
import candidatureService from "@/services/candidatureService";
import { useAuthStore } from "@/store/authStore";
import type { Offre, Candidature, StatutCandidature } from "@/types";

const DOMAINES = ["Tous", "Informatique", "Finance", "Marketing", "RH", "Commercial", "Ingénierie", "Autre"];

const STATUT_LABELS: Record<StatutCandidature, string> = {
  SOUMISE:         "Soumise",
  EN_COURS_EXAMEN: "En cours d'examen",
  ACCEPTEE:        "Acceptée",
  REFUSEE:         "Refusée",
};

const STATUT_BADGE: Record<StatutCandidature, string> = {
  SOUMISE:         "badge bg-blue-100   text-blue-700",
  EN_COURS_EXAMEN: "badge bg-yellow-100 text-yellow-700",
  ACCEPTEE:        "badge bg-green-100  text-green-700",
  REFUSEE:         "badge bg-red-100    text-red-600",
};

type Tab = "offres" | "candidatures";

export default function CandidateDashboard() {
  const { user } = useAuthStore();
  const [tab,           setTab]           = useState<Tab>("offres");
  const [offres,        setOffres]        = useState<Offre[]>([]);
  const [candidatures,  setCandidatures]  = useState<Candidature[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [filterDomaine, setFilterDomaine] = useState("Tous");
  const [selectedOffre, setSelectedOffre] = useState<Offre | null>(null);
  const [postuleLoading, setPostuleLoading] = useState(false);
  const [postuleError,   setPostuleError]   = useState<string | null>(null);
  const [postuleSuccess, setPostuleSuccess] = useState<string | null>(null);
  const [cvFile,         setCvFile]         = useState<File | null>(null);

  const postuleeIds = new Set(candidatures.map((c) => c.offre_id));

  useEffect(() => { fetchOffres(); fetchCandidatures(); }, []);
  useEffect(() => { fetchOffres(); }, [filterDomaine]);

  const fetchOffres = async () => {
    try {
      setLoading(true);
      const data = await offreService.listPublished(filterDomaine !== "Tous" ? filterDomaine : undefined);
      setOffres(data);
    } catch { setError("Impossible de charger les offres."); }
    finally { setLoading(false); }
  };

  const fetchCandidatures = async () => {
    try { const data = await candidatureService.mesCandidatures(); setCandidatures(data); }
    catch { /* silencieux */ }
  };

  const handlePostuler = async () => {
    if (!selectedOffre || !cvFile) return;
    setPostuleLoading(true); setPostuleError(null); setPostuleSuccess(null);
    try {
      await candidatureService.postuler(selectedOffre.id, cvFile);
      setPostuleSuccess("Candidature soumise avec succès !");
      await fetchCandidatures();
      setCvFile(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Erreur lors de la soumission.";
      setPostuleError(msg);
    } finally { setPostuleLoading(false); }
  };

  const openOffre = (offre: Offre) => {
    setSelectedOffre(offre); setPostuleError(null); setPostuleSuccess(null); setCvFile(null);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Espace Candidat</h1>
        <p className="text-gray-500 text-sm mt-1">Bonjour {user?.prenom ?? user?.email}</p>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {(["offres", "candidatures"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-white text-sky shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "offres" ? `Offres disponibles` : `Mes candidatures`}
            <span className="ml-1.5 badge bg-sky/10 text-sky text-xs">
              {t === "offres" ? offres.length : candidatures.length}
            </span>
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-amaranth text-sm rounded-lg px-4 py-3 mb-4">{error}</div>}

      {/* TAB Offres */}
      {tab === "offres" && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {DOMAINES.map((d) => (
              <button key={d} onClick={() => setFilterDomaine(d)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterDomaine === d ? "bg-sky text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-sky"}`}>
                {d}
              </button>
            ))}
          </div>
          {loading ? (
            <div className="card text-center text-gray-400 py-12">Chargement...</div>
          ) : offres.length === 0 ? (
            <div className="card text-center text-gray-400 py-12">Aucune offre disponible pour ce domaine.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offres.map((offre) => (
                <div key={offre.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{offre.titre}</h3>
                    <span className="badge bg-sky/10 text-sky text-xs shrink-0 ml-2">{offre.domaine}</span>
                  </div>
                  <p className="text-gray-500 text-sm line-clamp-3 mb-3">{offre.description}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400 mb-3">
                    {offre.annees_experience_min > 0 && <span>🎓 {offre.annees_experience_min} an{offre.annees_experience_min > 1 ? "s" : ""} exp.</span>}
                    {offre.date_debut_souhaitee && <span>📅 {new Date(offre.date_debut_souhaitee).toLocaleDateString("fr-FR")}</span>}
                  </div>
                  {offre.competences_requises.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {offre.competences_requises.slice(0, 4).map((c) => (
                        <span key={c} className="badge bg-gray-100 text-gray-500 text-xs">{c}</span>
                      ))}
                    </div>
                  )}
                  {postuleeIds.has(offre.id) ? (
                    <div className="w-full text-center py-2 text-sm text-green-600 bg-green-50 rounded-lg font-medium">✓ Candidature soumise</div>
                  ) : (
                    <button onClick={() => openOffre(offre)} className="btn-primary w-full text-sm">Voir et postuler</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB Candidatures */}
      {tab === "candidatures" && (
        candidatures.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 mb-4">Vous n'avez pas encore postulé à une offre.</p>
            <button onClick={() => setTab("offres")} className="btn-primary">Voir les offres</button>
          </div>
        ) : (
          <div className="space-y-3">
            {candidatures.map((c) => (
              <div key={c.id} className="card flex items-center justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{c.offre_titre ?? "Offre"}</h3>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {c.offre_domaine && <span>{c.offre_domaine} · </span>}CV : {c.cv_nom_fichier}
                  </p>
                  <p className="text-gray-400 text-xs">Soumise le {new Date(c.date_postulation).toLocaleDateString("fr-FR")}</p>
                </div>
                <span className={STATUT_BADGE[c.statut]}>{STATUT_LABELS[c.statut]}</span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Modal postulation */}
      {selectedOffre && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedOffre.titre}</h2>
                <p className="text-sky text-sm mt-0.5">{selectedOffre.domaine}</p>
              </div>
              <button onClick={() => setSelectedOffre(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold ml-4">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-4 max-h-32 overflow-y-auto">{selectedOffre.description}</p>
            {selectedOffre.competences_requises.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {selectedOffre.competences_requises.map((c) => <span key={c} className="badge bg-sky/10 text-sky text-xs">{c}</span>)}
              </div>
            )}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Téléversez votre CV <span className="text-gray-400 font-normal">(PDF, DOCX, DOC — 5 Mo max)</span>
              </p>
              <label className={`block w-full border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${cvFile ? "border-green-300 bg-green-50" : "border-gray-300 hover:border-sky"}`}>
                <input type="file" accept=".pdf,.docx,.doc" className="hidden" onChange={(e) => setCvFile(e.target.files?.[0] ?? null)} />
                {cvFile ? (
                  <div className="text-green-600 text-sm">
                    <p className="font-medium">✓ {cvFile.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(cvFile.size / 1024 / 1024).toFixed(2)} Mo</p>
                  </div>
                ) : (
                  <div className="text-gray-400 text-sm"><p className="text-2xl mb-1">📄</p><p>Cliquez pour sélectionner votre CV</p></div>
                )}
              </label>
              {postuleError   && <div className="mt-3 text-amaranth text-sm bg-red-50   border border-red-200   rounded-lg px-3 py-2">{postuleError}</div>}
              {postuleSuccess && <div className="mt-3 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-3 py-2">{postuleSuccess}</div>}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setSelectedOffre(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handlePostuler} disabled={!cvFile || postuleLoading || !!postuleSuccess} className="btn-primary flex-1">
                {postuleLoading ? "Envoi..." : "Soumettre ma candidature"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}