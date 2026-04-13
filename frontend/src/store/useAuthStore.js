import { create } from "zustand";
import api from "../api/http";

const savedToken = localStorage.getItem("token");
const savedUser = localStorage.getItem("user");
const savedTheme = localStorage.getItem("theme");
const savedColorScheme = localStorage.getItem("colorScheme");

export const useAuthStore = create((set, get) => ({
  token: savedToken || null,
  user: savedUser ? JSON.parse(savedUser) : null,
  theme: savedTheme || (savedUser ? JSON.parse(savedUser).theme : null) || "dark",
  colorScheme:
    savedColorScheme || (savedUser ? JSON.parse(savedUser).colorScheme : null) || "indigo",
  loading: false,
  error: null,

  signup: async ({ name, email, password }) => {
    set({ loading: true, error: null });
    try {
      const response = await api.post("/auth/signup", { name, email, password });
      const { token, user } = response.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("theme", user.theme || "dark");
      localStorage.setItem("colorScheme", user.colorScheme || "indigo");
      set({
        token,
        user,
        theme: user.theme || "dark",
        colorScheme: user.colorScheme || "indigo",
        loading: false,
        error: null,
      });
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
      localStorage.setItem("theme", user.theme || "dark");
      localStorage.setItem("colorScheme", user.colorScheme || "indigo");
      set({
        token,
        user,
        theme: user.theme || "dark",
        colorScheme: user.colorScheme || "indigo",
        loading: false,
        error: null,
      });
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
      localStorage.setItem("theme", user.theme || "dark");
      localStorage.setItem("colorScheme", user.colorScheme || "indigo");
      set({
        user,
        theme: user.theme || "dark",
        colorScheme: user.colorScheme || "indigo",
        error: null,
      });
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      set({
        token: null,
        user: null,
        theme: "dark",
        colorScheme: "indigo",
        error: "Session expired. Please login.",
      });
    }
  },

  updateProfile: async ({ name, avatarUrl, theme, colorScheme }) => {
    const { token } = get();
    if (!token) return false;
    set({ loading: true, error: null });
    try {
      const response = await api.put(
        "/auth/me",
        { name, avatarUrl, theme, colorScheme },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const user = response.data.user;
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("theme", user.theme || "dark");
      localStorage.setItem("colorScheme", user.colorScheme || "indigo");
      set({
        user,
        theme: user.theme || "dark",
        colorScheme: user.colorScheme || "indigo",
        loading: false,
        error: null,
      });
      return true;
    } catch (error) {
      const message = error.response?.data?.message || "Could not update profile.";
      set({ loading: false, error: message });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ token: null, user: null, theme: "dark", colorScheme: "indigo", error: null });
  },

  setTheme: (theme) => {
    const normalized = theme === "light" ? "light" : "dark";
    localStorage.setItem("theme", normalized);
    set((state) => {
      const nextUser = state.user ? { ...state.user, theme: normalized } : state.user;
      if (nextUser) {
        localStorage.setItem("user", JSON.stringify(nextUser));
      }
      return {
        theme: normalized,
        user: nextUser,
      };
    });
  },

  setColorScheme: (scheme) => {
    const normalized = ["indigo", "teal", "slate", "rose"].includes(scheme) ? scheme : "indigo";
    localStorage.setItem("colorScheme", normalized);
    set((state) => {
      const nextUser = state.user ? { ...state.user, colorScheme: normalized } : state.user;
      if (nextUser) {
        localStorage.setItem("user", JSON.stringify(nextUser));
      }
      return {
        colorScheme: normalized,
        user: nextUser,
      };
    });
  },

  resetMyData: async () => {
    const { token } = get();
    if (!token) return false;
    set({ loading: true, error: null });
    try {
      const response = await api.delete("/auth/reset-data", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = response.data.user;
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("theme", "dark");
      localStorage.setItem("colorScheme", "indigo");
      set({
        user,
        theme: "dark",
        colorScheme: "indigo",
        loading: false,
        error: null,
      });
      return true;
    } catch (error) {
      const message = error.response?.data?.message || "Could not reset data.";
      set({ loading: false, error: message });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));
