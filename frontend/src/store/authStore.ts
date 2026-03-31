import { create } from "zustand";
import type { Role, User } from "@/types";

interface AuthState {
  user:        User | null;
  role:        Role | null;
  isLoggedIn:  boolean;

  setAuth:     (user: User, token: string) => void;
  clearAuth:   () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  // Hydrate depuis localStorage au chargement de la page
  user:       null,
  role:       null,
  isLoggedIn: !!localStorage.getItem("access_token"),

  setAuth: (user, token) => {
    localStorage.setItem("access_token", token);
    set({ user, role: user.role, isLoggedIn: true });
  },

  clearAuth: () => {
    localStorage.removeItem("access_token");
    set({ user: null, role: null, isLoggedIn: false });
  },
}));
