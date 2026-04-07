/**
 * DashboardLayout.tsx — Wrapper commun à tous les dashboards
 *
 * Background "Aurora Mesh" premium inspiré des meilleurs SaaS (Vercel, Linear, Stripe) :
 * — Fond noir profond (#060D1F)
 * — 4 orbes de lumière colorées (bleu, violet, teal, indigo) animées en CSS
 * — Grain texture SVG ultra-léger pour la profondeur
 * — Pas de grille ni de motif répétitif — organique et moderne
 */
import { ReactNode } from "react";
import { motion } from "framer-motion";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{ background: "#060D1F" }}
    >

      {/* ── Aurora Mesh — Orbes de lumière animées ──────────────────
          Chaque orbe est une sphère de gradient flottant lentement.
          Les animations CSS "float" sont décalées pour un effet naturel.
      ──────────────────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">

        {/* Orbe 1 — Bleu roi, en haut à gauche */}
        <div
          className="absolute rounded-full"
          style={{
            width: "680px",
            height: "680px",
            top: "-200px",
            left: "-180px",
            background: "radial-gradient(circle, rgba(37,99,235,0.28) 0%, rgba(37,99,235,0.08) 45%, transparent 70%)",
            filter: "blur(40px)",
            animation: "aurora-drift-1 18s ease-in-out infinite",
          }}
        />

        {/* Orbe 2 — Violet, en haut à droite */}
        <div
          className="absolute rounded-full"
          style={{
            width: "560px",
            height: "560px",
            top: "-100px",
            right: "-100px",
            background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.06) 50%, transparent 70%)",
            filter: "blur(50px)",
            animation: "aurora-drift-2 22s ease-in-out infinite",
          }}
        />

        {/* Orbe 3 — Teal/Cyan, milieu gauche */}
        <div
          className="absolute rounded-full"
          style={{
            width: "500px",
            height: "500px",
            top: "40%",
            left: "5%",
            background: "radial-gradient(circle, rgba(20,184,166,0.14) 0%, rgba(20,184,166,0.04) 50%, transparent 70%)",
            filter: "blur(60px)",
            animation: "aurora-drift-3 26s ease-in-out infinite",
          }}
        />

        {/* Orbe 4 — Indigo, bas à droite */}
        <div
          className="absolute rounded-full"
          style={{
            width: "620px",
            height: "620px",
            bottom: "-200px",
            right: "10%",
            background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)",
            filter: "blur(55px)",
            animation: "aurora-drift-4 20s ease-in-out infinite",
          }}
        />

        {/* Orbe 5 — Bleu pâle subtil, centre */}
        <div
          className="absolute rounded-full"
          style={{
            width: "400px",
            height: "400px",
            top: "30%",
            left: "55%",
            background: "radial-gradient(circle, rgba(56,189,248,0.09) 0%, rgba(56,189,248,0.02) 50%, transparent 70%)",
            filter: "blur(70px)",
            animation: "aurora-drift-2 30s ease-in-out infinite reverse",
          }}
        />

        {/* ── Grain texture — SVG inline ultra-léger ──
            Crée une profondeur et un aspect "premium print" sur les fonds sombres.
            Opacité très basse pour rester subtil.
        ── */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.028]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <filter id="grain-filter">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="4"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain-filter)" />
        </svg>

        {/* ── Vignette douce sur les bords ──
            Assombrit légèrement les coins pour un effet cinématique.
        ── */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 50%, rgba(4,9,20,0.55) 100%)",
          }}
        />
      </div>

      {/* ── Keyframes CSS injectées via style tag ── */}
      <style>{`
        @keyframes aurora-drift-1 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(40px, -30px) scale(1.05); }
          66%  { transform: translate(-20px, 40px) scale(0.97); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes aurora-drift-2 {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(-35px, 25px) scale(1.04); }
          66%  { transform: translate(25px, -35px) scale(0.98); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes aurora-drift-3 {
          0%   { transform: translate(0px, 0px) scale(1); }
          40%  { transform: translate(30px, 40px) scale(1.06); }
          70%  { transform: translate(-15px, -20px) scale(0.96); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes aurora-drift-4 {
          0%   { transform: translate(0px, 0px) scale(1); }
          30%  { transform: translate(20px, -45px) scale(1.03); }
          65%  { transform: translate(-30px, 20px) scale(0.98); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
      `}</style>

      {/* ── Contenu principal ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
}
