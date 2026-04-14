/**
 * App.tsx — Routeur principal FairHire
 *
 * Changements vs version précédente :
 * - Import de useThemeStore pour initialiser le thème dès le mount
 * - La Navbar est conservée uniquement pour les pages sans sidebar
 * - Les pages avec sidebar (dashboards, profil) n'ont plus de Navbar flottante
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import { useThemeStore } from "@/store/themeStore";

import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ProfilePage from "@/pages/profile/ProfilePage";

import CandidateDashboard from "@/pages/candidate/CandidateDashboard";
import RecruiterDashboard from "@/pages/recruiter/RecruiterDashboard";
import AdminDashboard from "@/pages/admin/AdminDashboard";

/* ── Page 403 ─────────────────────────────────────────────── */
function UnauthorizedPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--surface-page)" }}
    >
      <div
        className="text-center max-w-sm p-10 rounded-2xl"
        style={{
          background: "var(--surface-card)",
          border: "1px solid var(--surface-border)",
        }}
      >
        <p className="text-4xl mb-4">🔒</p>
        <h2
          className="text-xl font-bold mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          Accès refusé
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
      </div>
    </div>
  );
}

/* ── App principale ─────────────────────────────────────────── */
export default function App() {
  // Initialise le thème (applique la classe dark/light sur <html>)
  const { theme } = useThemeStore();

  useEffect(() => {
    // Synchronise au montage (cas où le store est réhydraté)
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return (
    <BrowserRouter>
      {/*
        La Navbar est rendue ici mais se cache automatiquement
        sur toutes les routes avec sidebar (dashboards, profil).
        Voir Navbar.tsx pour la logique de visibilité.
      */}
      <Navbar />

      <Routes>
        {/* ── Publiques ────────────────────────────────── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ── Profil — tous les rôles connectés ──────── */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* ── Candidat ─────────────────────────────────── */}
        <Route
          path="/candidate/*"
          element={
            <ProtectedRoute allowedRoles={["CANDIDAT"]}>
              <Routes>
                <Route path="dashboard" element={<CandidateDashboard />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        {/* ── Recruteur ─────────────────────────────────── */}
        <Route
          path="/recruiter/*"
          element={
            <ProtectedRoute allowedRoles={["RECRUTEUR"]}>
              <Routes>
                <Route path="dashboard" element={<RecruiterDashboard />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        {/* ── Admin ──────────────────────────────────────── */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={["ADMINISTRATEUR"]}>
              <Routes>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        {/* ── Racine ─────────────────────────────────────── */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}