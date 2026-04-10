import { create } from "zustand";
import api from "../api/http";

const savedToken = localStorage.getItem("token");
const savedUser = localStorage.getItem("user");

export const useAuthStore = create((set, get) => ({
  token: savedToken || null,
  user: savedUser ? JSON.parse(savedUser) : null,
  loading: false,
  error: null,

  signup: async ({ name, email, password }) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/auth/signup", { name, email, password });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ token, user, loading: false, error: null });
      return true;
    } catch (error) {
      const message =
        error.response?.data?.message || "Signup failed. Please try again.";
      set({ loading: false, error: message });
      return false;
    }
  },

  login: async ({ email, password }) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ token, user, loading: false, error: null });
      return true;
    } catch (error) {
      const message =
        error.response?.data?.message || "Login failed. Please try again.";
      set({ loading: false, error: message });
      return false;
    }
  },

  fetchCurrentUser: async () => {
    const { token } = get();
    if (!token) return;

    try {
      const response = await api.get("/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const user = response.data.user;
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, error: null });
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      set({ token: null, user: null, error: "Session expired. Please login." });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
