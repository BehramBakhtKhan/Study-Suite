import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/useAuthStore";
import toast from "react-hot-toast";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api";

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Sends HTTP-only cookies automatically
});

let isRefreshing = false;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // 1. Guard against retrying the refresh endpoint itself
    const isRefreshRequest = originalRequest?.url?.includes("/auth/refresh-token");

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshRequest
    ) {
      originalRequest._retry = true;

      if (isRefreshing) return Promise.reject(error);
      isRefreshing = true;

      // toast.loading("Session expired. Refreshing token...", { id: "refresh-toast" });

      try {
        // 2. Use a direct un-intercepted Axios call to prevent infinite interceptor loops
        await axios.post(`${BASE_URL}/auth/refresh-token`, {}, { withCredentials: true });

        // toast.success("Token refreshed!", { id: "refresh-toast" });

        // Retry the original request with the newly set HTTP-only cookie
        return api(originalRequest);
      } catch (refreshErr) {
        // toast.error("Session expired. Please log in again.", { id: "refresh-toast" });

        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }

        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);