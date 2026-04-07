import api from "./api";
import type { Candidature } from "@/types";

const candidatureService = {
  // Soumet une candidature avec le CV en FormData
  postuler: (offreId: string, file: File) => {
    const formData = new FormData();
    formData.append("cv", file);
    return api.post<Candidature>(
      `/offres/${offreId}/postuler`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    ).then((r) => r.data);
  },


  // Candidatures du candidat connecté
  mesCandidatures: () =>
    api.get<Candidature[]>("/candidatures/mes").then((r) => r.data),

  // Candidatures d'une offre (recruteur)
  candidaturesOffre: (offreId: string) =>
    api.get<Candidature[]>(`/offres/${offreId}/candidatures`).then((r) => r.data),

    // Candidature + CV parsé (recruteur)
  getCandidature: (id: string) =>
    api.get<Candidature>(`/candidatures/${id}`).then((r) => r.data),

  // Mettre à jour le statut (recruteur)
  updateStatut: (candidatureId: string, statut: string) =>
    api.patch<Candidature>(`/candidatures/${candidatureId}/statut`, { statut })
       .then((r) => r.data),
};

  
export default candidatureService;