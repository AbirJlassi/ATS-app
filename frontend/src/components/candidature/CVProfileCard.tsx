import type { CVData, ParseStatut } from "@/types";

interface Props {
  cvData: CVData | undefined;
  parseStatut: ParseStatut;
  cvNomFichier: string;
  candidatureId: string;          // pour construire l'URL de téléchargement
  /** @deprecated — le nom est désormais affiché dans l'en-tête du panel, pas dans la carte */
  candidatNom?: string;
  /** @deprecated — le nom est désormais affiché dans l'en-tête du panel, pas dans la carte */
  candidatPrenom?: string;
  /** Fallback si cvData.email n'est pas disponible */
  candidatEmail?: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

export default function CVProfileCard({
  cvData, parseStatut, cvNomFichier,
  candidatureId, candidatEmail,
}: Props) {

  const downloadUrl = `${API_BASE}/cvs/download/${candidatureId}`;

  // ── Téléchargement authentifié ─────────────────────────────────
  const handleDownload = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cvNomFichier;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erreur téléchargement CV :", err);
    }
  };

  // ── Bouton CV réutilisable ────────────────────────────────────
  const CVButton = () => (
    <button onClick={handleDownload}
      className="inline-flex items-center justify-center gap-2 w-full
                 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10
                 text-slate-300 text-sm font-medium hover:bg-white/10
                 hover:border-white/20 transition-all cursor-pointer">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M3 2h5.5L11 4.5V13H3V2z" stroke="currentColor"
          strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M8.5 2v2.5H11" stroke="currentColor" strokeWidth="1.2"
          strokeLinejoin="round" />
        <path d="M5 7.5h5M5 10h3" stroke="currentColor" strokeWidth="1.2"
          strokeLinecap="round" />
      </svg>
      Voir le CV complet — {cvNomFichier}
    </button>
  );

  // ── Parsing en cours ──────────────────────────────────────────
  if (parseStatut === "EN_ATTENTE" || parseStatut === "EN_COURS") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4
                        flex items-center gap-3">
          <div className="w-4 h-4 rounded-full border-2 border-blue-400
                          border-t-transparent animate-spin shrink-0" />
          <div>
            <p className="text-sm text-slate-300">Analyse IA en cours...</p>
            <p className="text-xs text-slate-500 mt-0.5">{cvNomFichier}</p>
          </div>
        </div>
        <CVButton />
      </div>
    );
  }

  // ── Échec parsing ─────────────────────────────────────────────
  if (parseStatut === "ECHEC" || !cvData) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-xs text-slate-500">Analyse IA indisponible</p>
        </div>
        <CVButton />
      </div>
    );
  }

  // Email — priorité parser, fallback compte
  const displayEmail = cvData.email ?? candidatEmail;

  // ── Fiche complète ────────────────────────────────────────────
  //
  // NB : le nom du candidat n'est plus affiché ici — il figure désormais
  // uniquement dans l'en-tête du panel/page (au-dessus de cette carte),
  // ce qui évite la redondance visuelle.
  return (
    <div className="space-y-5">

      {/* Contact */}
      {(displayEmail || cvData.phone || cvData.linkedin || cvData.github) && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
            Contact
          </p>
          <div className="flex flex-col gap-1.5">
            {displayEmail && (
              <a href={`mailto:${displayEmail}`}
                className="flex items-center gap-2 text-sm text-slate-300
                           hover:text-white transition-colors w-fit">
                <span className="text-slate-500 text-xs">✉</span>
                {displayEmail}
              </a>
            )}
            {cvData.phone && (
              <span className="flex items-center gap-2 text-sm text-slate-300">
                <span className="text-slate-500 text-xs">☎</span>
                {cvData.phone}
              </span>
            )}
            {cvData.linkedin && (
              <a href={`https://${cvData.linkedin}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400
                           hover:text-blue-300 hover:underline transition-colors w-fit">
                <span className="text-xs font-bold">in</span>
                {cvData.linkedin}
              </a>
            )}
            {cvData.github && (
              <a href={`https://${cvData.github}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 text-sm text-slate-300
                           hover:text-white hover:underline transition-colors w-fit">
                <span className="text-xs">⌥</span>
                {cvData.github}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Résumé du profil */}
      {cvData.summary && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
            Résumé du profil
          </p>
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
            <p className="text-sm text-slate-300 leading-relaxed">{cvData.summary}</p>
          </div>
        </div>
      )}

      {/* Compétences principales */}
      {cvData.skills.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
            Compétences principales
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cvData.skills.map((s) => (
              <span key={s}
                className="px-2.5 py-1 rounded-lg text-xs font-medium
                           bg-blue-500/15 text-blue-300 border border-blue-500/20">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bouton CV complet */}
      <div className="pt-1">
        <CVButton />
      </div>

    </div>
  );
}