/**
 * DashboardLayout.tsx — Layout principal avec Sidebar + fond thémé
 *
 * Dark mode  → Aurora Mesh animée (#060D1F + orbes colorées)
 * Light mode → Fond gris clair neutre (#F4F5F7) avec légère texture
 *
 * Structure :
 *   <aside>  Sidebar collapsible (Sidebar.tsx)
 *   <main>   Zone de contenu scrollable
 */
import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useThemeStore } from "@/store/themeStore";
import Sidebar from "@/components/layout/Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

/* ── Fond Aurora — Dark mode uniquement ───────────────────── */
function AuroraMesh() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Orbe 1 — Bleu roi, haut gauche */}
      <div
        className="absolute rounded-full"
        style={{
          width: "680px", height: "680px", top: "-200px", left: "-180px",
          background: "radial-gradient(circle, rgba(37,99,235,0.28) 0%, rgba(37,99,235,0.08) 45%, transparent 70%)",
          filter: "blur(40px)",
          animation: "aurora-drift-1 18s ease-in-out infinite",
        }}
      />
      {/* Orbe 2 — Violet, haut droite */}
      <div
        className="absolute rounded-full"
        style={{
          width: "560px", height: "560px", top: "-100px", right: "-100px",
          background: "radial-gradient(circle, rgba(124,58,237,0.22) 0%, rgba(124,58,237,0.06) 50%, transparent 70%)",
          filter: "blur(50px)",
          animation: "aurora-drift-2 22s ease-in-out infinite",
        }}
      />
      {/* Orbe 3 — Teal, milieu gauche */}
      <div
        className="absolute rounded-full"
        style={{
          width: "500px", height: "500px", top: "40%", left: "5%",
          background: "radial-gradient(circle, rgba(20,184,166,0.14) 0%, rgba(20,184,166,0.04) 50%, transparent 70%)",
          filter: "blur(60px)",
          animation: "aurora-drift-3 26s ease-in-out infinite",
        }}
      />
      {/* Orbe 4 — Indigo, bas droite */}
      <div
        className="absolute rounded-full"
        style={{
          width: "620px", height: "620px", bottom: "-200px", right: "10%",
          background: "radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.05) 50%, transparent 70%)",
          filter: "blur(55px)",
          animation: "aurora-drift-4 20s ease-in-out infinite",
        }}
      />
      {/* Orbe 5 — Bleu pâle, centre */}
      <div
        className="absolute rounded-full"
        style={{
          width: "400px", height: "400px", top: "30%", left: "55%",
          background: "radial-gradient(circle, rgba(56,189,248,0.09) 0%, rgba(56,189,248,0.02) 50%, transparent 70%)",
          filter: "blur(70px)",
          animation: "aurora-drift-2 30s ease-in-out infinite reverse",
        }}
      />
      {/* Grain texture */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.028]" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain-filter">
          <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="4" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain-filter)" />
      </svg>
      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 90% 80% at 50% 50%, transparent 50%, rgba(4,9,20,0.55) 100%)" }}
      />
    </div>
  );
}

/* ── Fond Light — Texture subtile ─────────────────────────── */
function LightBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Dégradé très subtil en haut */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.06) 0%, transparent 60%)",
        }}
      />
    </div>
  );
}

/* ── Layout principal ─────────────────────────────────────── */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  return (
    <div
      className="flex min-h-screen"
      style={{ background: isDark ? "#060D1F" : "var(--surface-page)" }}
    >
      {/* Fond dynamique selon le thème */}
      {isDark ? <AuroraMesh /> : <LightBackground />}

      {/* ── Sidebar ── */}
      <Sidebar />

      {/* ── Zone de contenu principale ── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex-1 overflow-y-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}