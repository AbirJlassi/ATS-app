import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import { useThemeStore } from "@/store/themeStore";

import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ProfilePage from "@/pages/profile/ProfilePage";

import CandidateDashboard from "@/pages/candidate/CandidateDashboard";
import OffrePubliquePage from "@/pages/candidate/OffrePubliquePage";
import CandidatureCandidatPage from "@/pages/candidate/CandidatureCandidatPage";

import RecruiterDashboard from "@/pages/recruiter/RecruiterDashboard";
import OffreDetailPage from "@/pages/recruiter/OffreDetailPage";
import CandidatureDetailPage from "@/pages/recruiter/CandidatureDetailPage";

import AdminDashboard from "@/pages/admin/AdminDashboard";

function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface-page)" }}>
      <div className="text-center max-w-sm p-10 rounded-2xl" style={{ background: "var(--surface-card)", border: "1px solid var(--surface-border)" }}>
        <p className="text-4xl mb-4">🔒</p>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Accès refusé</h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* ── Publiques ── */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* ── Profil ── */}
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

        {/* ── Candidat ── */}
        <Route
          path="/candidate/*"
          element={<ProtectedRoute allowedRoles={["CANDIDAT"]}><Routes>
            <Route path="dashboard" element={<CandidateDashboard />} />
            <Route path="offres/:id" element={<OffrePubliquePage />} />
            <Route path="candidatures/:id" element={<CandidatureCandidatPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes></ProtectedRoute>}
        />

        {/* ── Recruteur ── */}
        <Route
          path="/recruiter/*"
          element={<ProtectedRoute allowedRoles={["RECRUTEUR"]}><Routes>
            <Route path="dashboard" element={<RecruiterDashboard />} />
            <Route path="offres/:id" element={<OffreDetailPage />} />
            <Route path="candidatures/:id" element={<CandidatureDetailPage />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes></ProtectedRoute>}
        />

        {/* ── Admin ── */}
        <Route
          path="/admin/*"
          element={<ProtectedRoute allowedRoles={["ADMINISTRATEUR"]}><Routes>
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes></ProtectedRoute>}
        />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}