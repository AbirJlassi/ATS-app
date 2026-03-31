import api from "./api";
import type { User, Role, Statut } from "@/types";

const adminService = {
  // Récupère tous les utilisateurs
  listUsers: () =>
    api.get<User[]>("/admin/users").then((r) => r.data),

  // Récupère un utilisateur par son id
  getUser: (id: string) =>
    api.get<User>(`/admin/users/${id}`).then((r) => r.data),

  // Modifie le statut ou le rôle d'un utilisateur
  updateUser: (id: string, data: { statut?: Statut; role?: Role }) =>
    api.patch<User>(`/admin/users/${id}`, data).then((r) => r.data),

  // Supprime un utilisateur
  deleteUser: (id: string) =>
    api.delete(`/admin/users/${id}`),
};

export default adminService;
