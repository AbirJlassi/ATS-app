/**
 * Toaster.tsx — Composant de rendu des notifications globales
 *
 * À monter une seule fois dans l'application (dans DashboardLayout).
 * Il écoute le useToastStore et affiche les toasts empilés en bas à droite.
 *
 * Positionnement : fixe, bas-droite sur desktop, bas-centré sur mobile.
 * Animations : framer-motion, entrée latérale fluide, sortie opacité.
 * Thème : compatible dark/light via variables CSS + classes Tailwind.
 */
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { useToastStore, type ToastType } from "@/store/toastStore";

/* ── Configuration visuelle par type ─────────────────────────── */
const TYPE_CONFIG: Record<
    ToastType,
    {
        icon: React.ReactNode;
        accentLight: string; // classes Tailwind pour le bord/fond accent
        accentDark: string;
        iconColor: string;
    }
> = {
    success: {
        icon: <CheckCircle2 className="w-5 h-5" />,
        accentLight: "border-emerald-500/40 bg-white",
        accentDark: "dark:border-emerald-400/30 dark:bg-slate-900/95",
        iconColor: "text-emerald-500 dark:text-emerald-400",
    },
    error: {
        icon: <AlertCircle className="w-5 h-5" />,
        accentLight: "border-red-500/40 bg-white",
        accentDark: "dark:border-red-400/30 dark:bg-slate-900/95",
        iconColor: "text-red-500 dark:text-red-400",
    },
    info: {
        icon: <Info className="w-5 h-5" />,
        accentLight: "border-blue-500/40 bg-white",
        accentDark: "dark:border-blue-400/30 dark:bg-slate-900/95",
        iconColor: "text-blue-500 dark:text-blue-400",
    },
    warning: {
        icon: <AlertTriangle className="w-5 h-5" />,
        accentLight: "border-amber-500/40 bg-white",
        accentDark: "dark:border-amber-400/30 dark:bg-slate-900/95",
        iconColor: "text-amber-500 dark:text-amber-400",
    },
};

/* ── Composant Toaster ───────────────────────────────────────── */
export default function Toaster() {
    const toasts = useToastStore((s) => s.toasts);
    const dismiss = useToastStore((s) => s.dismiss);

    return (
        <div
            className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100]
                       flex flex-col gap-2.5 items-stretch sm:items-end
                       pointer-events-none w-auto sm:w-[380px] max-w-full"
            aria-live="polite"
            aria-atomic="true"
        >
            <AnimatePresence initial={false}>
                {toasts.map((t) => {
                    const cfg = TYPE_CONFIG[t.type];
                    return (
                        <motion.div
                            key={t.id}
                            layout
                            initial={{ opacity: 0, x: 40, scale: 0.96 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                            className={`pointer-events-auto w-full rounded-2xl border shadow-lg
                                        backdrop-blur-xl px-4 py-3.5
                                        flex items-start gap-3
                                        ${cfg.accentLight} ${cfg.accentDark}`}
                            style={{
                                boxShadow:
                                    "0 10px 30px -8px rgba(0,0,0,0.12), 0 4px 12px -4px rgba(0,0,0,0.08)",
                            }}
                        >
                            {/* Icône */}
                            <div className={`shrink-0 mt-0.5 ${cfg.iconColor}`}>
                                {cfg.icon}
                            </div>

                            {/* Contenu */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                                    {t.title}
                                </p>
                                {t.description && (
                                    <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 leading-relaxed">
                                        {t.description}
                                    </p>
                                )}
                            </div>

                            {/* Bouton dismiss */}
                            <button
                                onClick={() => dismiss(t.id)}
                                className="shrink-0 text-gray-400 dark:text-slate-500
                                           hover:text-gray-700 dark:hover:text-slate-200
                                           transition-colors -mr-1 -mt-0.5 p-1 rounded-md
                                           hover:bg-black/5 dark:hover:bg-white/5"
                                aria-label="Fermer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}