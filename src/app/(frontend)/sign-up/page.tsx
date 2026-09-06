"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { useShallow } from "zustand/react/shallow";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SignupSchema, type SignupInput } from "@/lib/validatons/auth/auth";

export default function SignupPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { signup, isLoading } = useAuthStore(
    useShallow((state) => ({
      signup: state.signup,
      isLoading: state.isLoading,
    }))
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(SignupSchema),
    mode: "onBlur",
  });

  const onSubmit = async (data: SignupInput) => {
    try {
      await signup(data);
      toast.success("Account created successfully!");
      router.push("/login");
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
        err.message ||
        "Failed to create account. Please try again."
      );
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        {/* Header */}
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Create an Account
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Join Study Suite to set up your workspace
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          {/* Username Field */}
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-300"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              aria-invalid={errors.username ? "true" : "false"}
              aria-describedby={errors.username ? "username-error" : undefined}
              {...register("username")}
              placeholder="johndoe"
              className={`w-full px-4 py-2.5 rounded-lg bg-slate-800/60 border text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 hover:border-slate-600 ${errors.username
                  ? "border-red-500/80 focus:ring-red-500/80 focus:border-red-500"
                  : "border-slate-700/80 focus:ring-indigo-500/80 focus:border-indigo-500 focus:bg-slate-800"
                }`}
            />
            {errors.username && (
              <p
                id="username-error"
                role="alert"
                className="text-xs font-medium text-red-400 mt-1"
              >
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
              placeholder="student@example.com"
              className={`w-full px-4 py-2.5 rounded-lg bg-slate-800/60 border text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 hover:border-slate-600 ${errors.email
                  ? "border-red-500/80 focus:ring-red-500/80 focus:border-red-500"
                  : "border-slate-700/80 focus:ring-indigo-500/80 focus:border-indigo-500 focus:bg-slate-800"
                }`}
            />
            {errors.email && (
              <p
                id="email-error"
                role="alert"
                className="text-xs font-medium text-red-400 mt-1"
              >
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-invalid={errors.password ? "true" : "false"}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
                placeholder="••••••••"
                className={`w-full pr-11 pl-4 py-2.5 rounded-lg bg-slate-800/60 border text-white placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-2 hover:border-slate-600 ${errors.password
                    ? "border-red-500/80 focus:ring-red-500/80 focus:border-red-500"
                    : "border-slate-700/80 focus:ring-indigo-500/80 focus:border-indigo-500 focus:bg-slate-800"
                  }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 focus:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md transition-colors"
              >
                {showPassword ? (
                  /* Eye Off Icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  /* Eye Icon */
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12c1.341-4.55 5.43-7.5 9.964-7.5 4.533 0 8.623 2.95 9.965 7.5-1.342 4.55-5.432 7.5-9.965 7.5-4.534 0-8.623-2.95-9.964-7.5z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-xs font-medium text-red-400 mt-1"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg shadow-indigo-600/20"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Creating account...</span>
              </>
            ) : (
              <span>Sign Up</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-slate-800/80 text-center">
          <p className="text-sm text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-sm"
            >
              Sign in
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}