import { api } from "@/lib/axios";
import { create } from "zustand";

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt?: string;
}

interface UserStore {
  users: User[];
  isLoading: boolean;
  error: string | null;
  fetchAllUsers: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchAllUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/users");
      set({ users: response.data.users, isLoading: false})
    } catch (err: any) {
      set({ error: err.message || "Failed to fetch users", isLoading: false });
    }
  },

}));