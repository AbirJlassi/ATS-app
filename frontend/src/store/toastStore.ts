/**
 * toastStore.ts — Store global des notifications (toasts)
 *
 * Système léger de notifications, s'intégrant au reste de l'architecture Zustand.
 * Utilisation :
 *   import { toast } from "@/store/toastStore";
 *   toast.success("Offre publiée", "Votre offre est désormais visible par les candidats.");
 *   toast.error("Erreur lors de la suppression");
 *   toast.info("Analyse IA en cours…");
 *   toast.warning("Cette action est irréversible");
 *
 * Options :
 *   toast.success("…", "…", { duration: 6000 })
 *   toast.dismiss(id)  // dismiss manuel
 *
 * Le rendu est assuré par <Toaster /> (cf. Toaster.tsx), monté globalement
 * dans DashboardLayout.
 */
import { create } from "zustand";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    duration: number;
}

interface ToastStore {
    toasts: Toast[];
    show: (toast: Omit<Toast, "id" | "duration"> & { duration?: number }) => string;
    dismiss: (id: string) => void;
    clearAll: () => void;
}

const DEFAULT_DURATION = 4500;

/* ── Store Zustand ──────────────────────────────────────────── */
export const useToastStore = create<ToastStore>((set, get) => ({
    toasts: [],

    show: ({ type, title, description, duration }) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const toast: Toast = {
            id,
            type,
            title,
            description,
            duration: duration ?? DEFAULT_DURATION,
        };
        set((state) => ({ toasts: [...state.toasts, toast] }));

        // Auto-dismiss
        if (toast.duration > 0) {
            setTimeout(() => {
                get().dismiss(id);
            }, toast.duration);
        }
        return id;
    },

    dismiss: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

    clearAll: () => set({ toasts: [] }),
}));

/* ── API raccourci (sucre syntaxique) ───────────────────────── */
type ToastOptions = { duration?: number };

export const toast = {
    success: (title: string, description?: string, options?: ToastOptions) =>
        useToastStore.getState().show({ type: "success", title, description, ...options }),

    error: (title: string, description?: string, options?: ToastOptions) =>
        useToastStore.getState().show({ type: "error", title, description, ...options }),

    info: (title: string, description?: string, options?: ToastOptions) =>
        useToastStore.getState().show({ type: "info", title, description, ...options }),

    warning: (title: string, description?: string, options?: ToastOptions) =>
        useToastStore.getState().show({ type: "warning", title, description, ...options }),

    dismiss: (id: string) => useToastStore.getState().dismiss(id),
    clearAll: () => useToastStore.getState().clearAll(),
};