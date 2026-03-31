export type Role    = "CANDIDAT" | "RECRUTEUR" | "ADMINISTRATEUR";
export type Statut  = "EN_ATTENTE" | "ACTIF" | "SUSPENDU";
export type StatutOffre = "BROUILLON" | "PUBLIEE" | "FERMEE";
export type StatutCandidature = "SOUMISE" | "EN_COURS_EXAMEN" | "ACCEPTEE" | "REFUSEE";


export interface Candidature {
  id:             string;
  statut:       StatutCandidature;
  cv_nom_fichier: string;
  date_postulation: string;
  candidat_id:    string;
  offre_id:      string;
  offre_titre?:   string;
  offre_domaine?:  string;
  candidat_nom?:   string;
  candidat_prenom?: string;
  candidat_email?:  string;
}
export interface User {
  id:          string;
  email:       string;
  role:        Role;
  statut:      Statut;
  nom:         string | null;
  prenom:      string | null;
  telephone:   string | null;
  departement: string | null;
  created_at:  string;
}

export interface Token {
  access_token: string;
  token_type:   string;
  role:         Role;
  user_id:      string;
}

export interface Offre {
  id:                    string;
  titre:                 string;
  description:           string;
  domaine:               string;
  competences_requises:  string[];
  annees_experience_min: number;
  date_debut_souhaitee:  string | null;
  statut:                StatutOffre;
  recruteur_id:          string;
  recruteur_nom:         string | null;
  recruteur_prenom:      string | null;
  created_at:            string;
}

export interface OffreCreate {
  titre:                 string;
  description:           string;
  domaine:               string;
  competences_requises:  string[];
  annees_experience_min: number;
  date_debut_souhaitee?: string;
}

export interface OffreUpdate extends Partial<OffreCreate> {
  statut?: StatutOffre;
}

export interface ApiError {
  detail: string;
}