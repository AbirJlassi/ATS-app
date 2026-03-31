import api from "./api";
import type { Token, User } from "@/types";

export interface RegisterData {
  email:       string;
  password:    string;
  role:        "CANDIDAT" | "RECRUTEUR";
  nom?:        string;
  prenom?:     string;
  telephone?:  string;
  departement?:string;
}

export interface LoginData {
  email:    string;
  password: string;
}

export interface UpdateProfileData {
  nom?:        string;
  prenom?:     string;
  telephone?:  string;
  departement?:string;
  password?:   string;
}

const authService = {
  register: (data: RegisterData) =>
    api.post<User>("/auth/register", data).then((r) => r.data),

  login: (data: LoginData) =>
    api.post<Token>("/auth/login", data).then((r) => r.data),

  getMe: () =>
    api.get<User>("/auth/me").then((r) => r.data),

  updateMe: (data: UpdateProfileData) =>
    api.patch<User>("/auth/me", data).then((r) => r.data),

  logout: () => {
    localStorage.removeItem("access_token");
  },
};

export default authService;
