import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import ProtectedRoute from "@/components/common/ProtectedRoute";

import LoginPage    from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ProfilePage  from "@/pages/profile/ProfilePage";

import CandidateDashboard from "@/pages/candidate/CandidateDashboard";
import RecruiterDashboard from "@/pages/recruiter/RecruiterDashboard";
import AdminDashboard     from "@/pages/admin/AdminDashboard";

function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-snow">
      <div className="card text-center max-w-sm">
        <p className="text-4xl mb-4">🔒</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Accès refusé</h2>
        <p className="text-gray-500 text-sm">
          Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            {/* ── Publiques ─────────────────────────────── */}
            <Route path="/login"        element={<LoginPage />} />
            <Route path="/register"     element={<RegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* ── Profil — tous les rôles connectés ─────── */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            {/* ── Candidat ──────────────────────────────── */}
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

            {/* ── Recruteur ─────────────────────────────── */}
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

            {/* ── Admin ─────────────────────────────────── */}
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

            {/* ── Racine ────────────────────────────────── */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}