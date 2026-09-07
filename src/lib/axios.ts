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

    // 1. Guard against retrying the refresh endpoint AND the login endpoint itself
    const isRefreshRequest = originalRequest?.url?.includes("/auth/refresh-token");
    const isLoginRequest = originalRequest?.url?.includes("/auth/login"); // Add your actual login route string here

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      !isLoginRequest // 👈 ADD THIS: Skip interceptor if the failed request was a login
    ) {
      originalRequest._retry = true;

      if (isRefreshing) return Promise.reject(error);
      isRefreshing = true;

      try {
        await axios.post(`${BASE_URL}/auth/refresh-token`, {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshErr) {
        useAuthStore.getState().logout();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // This ensures your login component's catch block receives the original 401 response
    return Promise.reject(error);
  }
);

