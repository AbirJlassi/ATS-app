import api from "./api";
import type { MatchResult } from "@/components/matching/MatchScoreCard";

const matchingService = {
  /** Récupère le score de matching d'une candidature. Renvoie null si non disponible (404). */
  getMatchResult: async (candidatureId: string): Promise<MatchResult | null> => {
    try {
      const { data } = await api.get<MatchResult>(`/matching/candidatures/${candidatureId}`);
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },
};

export default matchingService;
