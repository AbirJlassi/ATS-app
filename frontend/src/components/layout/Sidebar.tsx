/**
 * Sidebar.tsx — Navigation latérale par rôle
 *
 * Fonctionnalités :
 * - Liens adaptés au rôle (CANDIDAT / RECRUTEUR / ADMINISTRATEUR)
 * - Collapsible : mode icônes uniquement (64px) ou texte complet (220px)
 * - Indicateur actif sur la route courante
 * - Avatar + nom en bas de sidebar
 * - Bouton toggle dark/light mode intégré
 * - Compatible dark/light via CSS variables
 */
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Briefcase,
    Users,
    Globe,
    User,
    ChevronLeft,
    ChevronRight,
    Sun,
    Moon,
    LogOut,
    Shield,
    BarChart3,
    FlaskConical,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import authService from "@/services/authService";
import { useNavigate } from "react-router-dom";
import type { Role } from "@/types";

/* ── Types ─────────────────────────────────────────────────── */
interface NavItem {
    label: string;
    href: string;
    icon: React.ReactNode;
    badge?: number;
    activePatterns?: string[];
}

/* ── Config navigation par rôle ────────────────────────────── */
function getNavItems(role: Role | null): NavItem[] {
    switch (role) {
        case "CANDIDAT":
            return [
                {
                    label: "Tableau de bord",
                    href: "/candidate/dashboard",
                    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
                },
                {
                    label: "Offres disponibles",
                    href: "/candidate/dashboard?tab=offres",
                    icon: <Globe className="w-[18px] h-[18px]" />,
                    activePatterns: ["/candidate/offres/"],
                },
                {
                    label: "Mes candidatures",
                    href: "/candidate/dashboard?tab=candidatures",
                    icon: <Briefcase className="w-[18px] h-[18px]" />,
                    activePatterns: ["/candidate/candidatures/"],
                },
                {
                    label: "Mon profil",
                    href: "/profile",
                    icon: <User className="w-[18px] h-[18px]" />,
                },
            ];

        case "RECRUTEUR":
            return [
                {
                    label: "Tableau de bord",
                    href: "/recruiter/dashboard",
                    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
                },
                {
                    label: "Mes offres",
                    href: "/recruiter/dashboard?tab=mes-offres",
                    icon: <Briefcase className="w-[18px] h-[18px]" />,
                    activePatterns: ["/recruiter/offres/"],
                },
                {
                    label: "Candidatures",
                    href: "/recruiter/dashboard?tab=candidatures",
                    icon: <Users className="w-[18px] h-[18px]" />,
                    activePatterns: ["/recruiter/candidatures/"],
                },
                {
                    label: "Mon profil",
                    href: "/profile",
                    icon: <User className="w-[18px] h-[18px]" />,
                },
            ];

        case "ADMINISTRATEUR":
            return [
                {
                    label: "Tableau de bord",
                    href: "/admin/dashboard",
                    icon: <LayoutDashboard className="w-[18px] h-[18px]" />,
                },
                {
                    label: "Utilisateurs",
                    href: "/admin/dashboard?tab=users",
                    icon: <Users className="w-[18px] h-[18px]" />,
                },
                {
                    label: "Offres",
                    href: "/admin/dashboard?tab=offres",
                    icon: <Briefcase className="w-[18px] h-[18px]" />,
                },
                {
                    label: "Statistiques",
                    href: "/admin/dashboard?tab=stats",
                    icon: <BarChart3 className="w-[18px] h-[18px]" />,
                },
                {
                    label: "Qualité IA",
                    href: "/admin/dashboard?tab=benchmark",
                    icon: <FlaskConical className="w-[18px] h-[18px]" />,
                },
                {
                    label: "Mon profil",
                    href: "/profile",
                    icon: <User className="w-[18px] h-[18px]" />,
                },
            ];

        default:
            return [];
    }
}

/* ── Labels & meta par rôle ─────────────────────────────────── */
const ROLE_META: Record<string, { label: string; color: string }> = {
    CANDIDAT: { label: "Candidat", color: "text-blue-500" },
    RECRUTEUR: { label: "Recruteur", color: "text-violet-500" },
    ADMINISTRATEUR: { label: "Admin", color: "text-amber-500" },
};

/* ── Logo SVG ────────────────────────────────────────────────── */
function Logo({ size = 20 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <line x1="10" y1="3" x2="10" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="3" y1="7" x2="17" y2="7" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
            <line x1="3" y1="7" x2="3" y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="17" y1="7" x2="17" y2="10" stroke="#60A5FA" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="3" cy="12" r="2" fill="#FCD34D" />
            <path d="M0.5 17 Q3 14.5 5.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="17" cy="12" r="2" fill="#FCD34D" />
            <path d="M14.5 17 Q17 14.5 19.5 17" stroke="#FCD34D" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="7" y1="16" x2="13" y2="16" stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

/* ── Composant principal ─────────────────────────────────────── */
export default function Sidebar() {
    const { user, role, clearAuth } = useAuthStore();
    const { theme, toggleTheme } = useThemeStore();
    const [collapsed, setCollapsed] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const navItems = getNavItems(role);
    const roleMeta = ROLE_META[role ?? ""] ?? { label: role, color: "text-slate-400" };

    const initials = user?.prenom?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?";
    const fullName = user?.prenom && user?.nom
        ? `${user.prenom} ${user.nom}`
        : user?.email?.split("@")[0] ?? "";

    const handleLogout = () => {
        authService.logout();
        clearAuth();
        navigate("/login");
    };

    /* ── Vérifie si un item est actif ── */
    const isActive = (item: NavItem) => {
        // 1. Sous-routes dédiées (ex: /candidate/offres/:id)
        if (item.activePatterns) {
            for (const pattern of item.activePatterns) {
                if (location.pathname.startsWith(pattern)) return true;
            }
        }
        // 2. Correspondance classique path + query tab
        const [path, query] = item.href.split("?");
        const searchParam = new URLSearchParams(query);
        const tab = searchParam.get("tab");
        if (location.pathname !== path) return false;
        if (tab) {
            return new URLSearchParams(location.search).get("tab") === tab;
        }
        return !new URLSearchParams(location.search).get("tab");
    };

    const W_EXPANDED = 220;
    const W_COLLAPSED = 64;

    return (
        <motion.aside
            animate={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="relative flex-shrink-0 flex flex-col h-screen sticky top-0 z-30 overflow-hidden"
            style={{
                background: "var(--sidebar-bg)",
                borderRight: "1px solid var(--sidebar-border)",
            }}
        >
            {/* ── Header — Logo + Toggle collapse ── */}
            <div
                className="flex items-center justify-between px-4 h-14 flex-shrink-0"
                style={{ borderBottom: "1px solid var(--sidebar-border)" }}
            >
                {/* Logo */}
                <Link
                    to={
                        role === "CANDIDAT" ? "/candidate/dashboard" :
                            role === "RECRUTEUR" ? "/recruiter/dashboard" :
                                role === "ADMINISTRATEUR" ? "/admin/dashboard" : "/"
                    }
                    className="flex items-center gap-2.5 min-w-0"
                >
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <Logo size={18} />
                    </div>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.span
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ duration: 0.18 }}
                                className="font-bold text-[15px] tracking-tight whitespace-nowrap overflow-hidden"
                                style={{ color: "var(--text-primary)" }}
                            >
                                Fair<span className="text-blue-500">Hire</span>
                            </motion.span>
                        )}
                    </AnimatePresence>
                </Link>

                {/* Bouton collapse */}
                <button
                    onClick={() => setCollapsed((c) => !c)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 flex-shrink-0"
                    style={{
                        background: "var(--surface-hover)",
                        color: "var(--text-muted)",
                    }}
                    aria-label={collapsed ? "Développer la sidebar" : "Réduire la sidebar"}
                >
                    {collapsed
                        ? <ChevronRight className="w-3.5 h-3.5" />
                        : <ChevronLeft className="w-3.5 h-3.5" />
                    }
                </button>
            </div>

            {/* ── Navigation principale ── */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2">
                <div className="space-y-0.5">
                    {navItems.map((item) => {
                        const active = isActive(item);
                        return (
                            <Link
                                key={item.href}
                                to={item.href}
                                title={collapsed ? item.label : undefined}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group relative"
                                style={{
                                    background: active ? "var(--sidebar-item-active-bg)" : "transparent",
                                    color: active ? "var(--sidebar-item-active-text)" : "var(--text-secondary)",
                                }}
                                onMouseEnter={(e) => {
                                    if (!active) {
                                        (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-hover)";
                                        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!active) {
                                        (e.currentTarget as HTMLElement).style.background = "transparent";
                                        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                                    }
                                }}
                            >
                                {/* Indicateur actif */}
                                {active && (
                                    <span
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-blue-500"
                                    />
                                )}

                                {/* Icône */}
                                <span className={`flex-shrink-0 transition-colors duration-150 ${active ? "text-blue-500" : ""}`}>
                                    {item.icon}
                                </span>

                                {/* Label */}
                                <AnimatePresence>
                                    {!collapsed && (
                                        <motion.span
                                            initial={{ opacity: 0, x: -6 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -6 }}
                                            transition={{ duration: 0.15 }}
                                            className={`text-sm font-medium whitespace-nowrap overflow-hidden ${active ? "font-semibold" : ""
                                                }`}
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>

                                {/* Badge */}
                                {item.badge && item.badge > 0 && (
                                    <AnimatePresence>
                                        {!collapsed && (
                                            <motion.span
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                className="ml-auto text-xs font-bold bg-blue-500 text-white rounded-full px-1.5 py-0.5 min-w-[20px] text-center"
                                            >
                                                {item.badge}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* ── Footer ── */}
            <div
                className="flex-shrink-0 p-2 space-y-0.5"
                style={{ borderTop: "1px solid var(--sidebar-border)" }}
            >
                {/* Toggle Dark / Light */}
                <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm"
                    style={{ color: "var(--text-secondary)" }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "var(--sidebar-item-hover)";
                        (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    }}
                    title={collapsed ? (theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre") : undefined}
                    aria-label="Changer le thème"
                >
                    <span className="flex-shrink-0">
                        {theme === "dark"
                            ? <Sun className="w-[18px] h-[18px]" />
                            : <Moon className="w-[18px] h-[18px]" />
                        }
                    </span>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.span
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                transition={{ duration: 0.15 }}
                                className="font-medium whitespace-nowrap"
                            >
                                {theme === "dark" ? "Mode clair" : "Mode sombre"}
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>

                {/* Déconnexion */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 text-sm text-red-500"
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)";
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                    title={collapsed ? "Se déconnecter" : undefined}
                    aria-label="Se déconnecter"
                >
                    <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.span
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                transition={{ duration: 0.15 }}
                                className="font-medium whitespace-nowrap"
                            >
                                Se déconnecter
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>

                {/* Carte utilisateur */}
                <div
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mt-1"
                    style={{
                        background: "var(--surface-card-alt)",
                        border: "1px solid var(--surface-border)",
                    }}
                >
                    {/* Avatar */}
                    <div
                        className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600
                       flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    >
                        {initials}
                    </div>

                    {/* Infos */}
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.div
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -6 }}
                                transition={{ duration: 0.15 }}
                                className="min-w-0 flex-1 overflow-hidden"
                            >
                                <p
                                    className="text-sm font-semibold truncate leading-tight"
                                    style={{ color: "var(--text-primary)" }}
                                >
                                    {fullName}
                                </p>
                                <p className={`text-xs font-medium truncate ${roleMeta.color}`}>
                                    <Shield className="inline w-3 h-3 mr-0.5 -mt-px" />
                                    {roleMeta.label}
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.aside>
    );
}