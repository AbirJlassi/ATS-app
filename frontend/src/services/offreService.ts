import api from "./api";
import type { Offre, OffreCreate, OffreUpdate } from "@/types";

const offreService = {
  // Public — pas besoin d'être connecté
  listPublished: (domaine?: string) =>
    api.get<Offre[]>("/offres", { params: domaine ? { domaine } : {} }).then((r) => r.data),

  getById: (id: string) =>
    api.get<Offre>(`/offres/${id}`).then((r) => r.data),

  // Recruteur
  mesOffres: () =>
    api.get<Offre[]>("/offres/mes-offres").then((r) => r.data),

  create: (data: OffreCreate) =>
    api.post<Offre>("/offres/", data).then((r) => r.data),

  update: (id: string, data: OffreUpdate) =>
    api.patch<Offre>(`/offres/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    api.delete(`/offres/${id}`),
};

export default offreService;