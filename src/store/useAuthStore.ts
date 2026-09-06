import { create } from "zustand";
import { api } from "@/lib/axios";
import { User } from "@/types/auth";

interface AuthState {
  users: User[];
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  signup: (credentials: { email: string; password: string; username: string }) => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  refreshToken: () => Promise<void>;
  logout: () => Promise<void>;
  me: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  users: [],
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  signup: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/auth/signup", credentials);
      const { user } = response.data;

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Signup failed";
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/auth/login", credentials);
      const { user } = response.data;

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Login failed";
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  refreshToken: async () => {
    set({ isLoading: true });
    try {
      const response = await api.post("/auth/refresh-token");
      const { user } = response.data;

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  me: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/users/me");
      const user = response.data.user || response.data;
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err: any) {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null, // Clear error on initial check to avoid UI error flashes
      });
    }
  },
}));