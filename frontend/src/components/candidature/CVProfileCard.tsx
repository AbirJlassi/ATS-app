import type { CVData, ParseStatut } from "@/types";

interface Props {
  cvData:       CVData | undefined;
  parseStatut:  ParseStatut;
  cvNomFichier: string;
}

/**
 * Fiche profil enrichie par le parser IA.
 * Affichée dans la vue recruteur — candidatures d'une offre.
 */
export default function CVProfileCard({ cvData, parseStatut, cvNomFichier }: Props) {

  // ── États du parsing ──────────────────────────────────────────
  if (parseStatut === "EN_ATTENTE" || parseStatut === "EN_COURS") {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
        <div>
          <p className="text-sm text-slate-300">Analyse IA en cours...</p>
          <p className="text-xs text-slate-500">{cvNomFichier}</p>
        </div>
      </div>
    );
  }

  if (parseStatut === "ECHEC" || !cvData) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <p className="text-sm text-slate-400">📄 {cvNomFichier}</p>
        <p className="text-xs text-slate-500 mt-0.5">Analyse IA indisponible</p>
      </div>
    );
  }

  // ── Fiche complète ────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Résumé IA */}
      {cvData.summary && (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
          <p className="text-[11px] font-bold text-blue-400 uppercase tracking-wide mb-1.5">
            Résumé IA
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">{cvData.summary}</p>
        </div>
      )}

      {/* Infos de contact extraites */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400">
        {cvData.location  && <span className="flex items-center gap-1.5">📍 {cvData.location}</span>}
        {cvData.phone     && <span className="flex items-center gap-1.5">📞 {cvData.phone}</span>}
        {cvData.linkedin  && (
          <a href={`https://${cvData.linkedin}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline transition-colors block">
            LinkedIn ↗
          </a>
        )}
        {cvData.github    && (
          <a href={`https://${cvData.github}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-slate-300 hover:text-white hover:underline transition-colors block">
            GitHub ↗
          </a>
        )}
      </div>

      {/* Compétences */}
      {cvData.skills.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
            Compétences
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cvData.skills.map((s) => (
              <span key={s} className="px-2.5 py-1 rounded-lg text-xs bg-blue-500/15 text-blue-300 border border-blue-500/20 font-medium">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expériences */}
      {cvData.experiences.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3 mt-4">
            Expériences
          </p>
          <div className="space-y-4">
            {cvData.experiences.map((exp, i) => (
              <div key={i} className="border-l-2 border-white/10 pl-4 py-1 relative">
                <div className="absolute w-2 h-2 rounded-full bg-slate-600 -left-[5px] top-2" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{exp.title}</p>
                    {exp.company && (
                      <p className="text-xs text-slate-400 mt-0.5">{exp.company}
                        {exp.location && <span className="text-slate-500"> · {exp.location}</span>}
                      </p>
                    )}
                  </div>
                  {exp.period && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded pl-2 bg-white/5 text-slate-400 whitespace-nowrap shrink-0">
                      {exp.period}
                    </span>
                  )}
                </div>
                {exp.description && (
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formation */}
      {cvData.education.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3 mt-4">
            Formation
          </p>
          <div className="space-y-3">
            {cvData.education.map((edu, i) => (
              <div key={i} className="flex items-start justify-between gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
                <div>
                  <p className="text-sm font-semibold text-white">{edu.degree}</p>
                  {edu.institution && (
                    <p className="text-xs text-slate-400 mt-0.5">{edu.institution}
                      {edu.location && <span> · {edu.location}</span>}
                    </p>
                  )}
                </div>
                {edu.period && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white/5 text-slate-400 whitespace-nowrap shrink-0">
                    {edu.period}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Langues & Certifications */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        {cvData.languages.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              Langues
            </p>
            <div className="flex flex-wrap gap-2">
              {cvData.languages.map((l, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-slate-300 border border-white/10">
                  {l.language}{l.level && <span className="text-slate-500"> · {l.level}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {cvData.certifications.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">
              Certifications
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cvData.certifications.map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-lg text-xs bg-white/5 text-slate-300 border border-white/10">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}