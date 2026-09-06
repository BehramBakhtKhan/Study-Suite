"use client";

import { useEffect, useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import { useUserStore } from "@/store/useUserStore";
import toast from "react-hot-toast";

export default function AdminDashboardPage() {
  const { users, isLoading, error, fetchAllUsers } = useUserStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers]);

  // Handle toast notifications outside JSX render cycle
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  // Filter users based on search input and role filter
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-x-hidden">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Admin Dashboard</h1>
              <p className="text-xs text-slate-400 mt-1">
                Manage system accounts, permissions, and platform access
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono font-medium">
                Total Users: {users.length}
              </span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search by username or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {(["all", "admin", "user"] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                    roleFilter === role
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* Data Table */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-slate-900/40 border border-slate-800 rounded-2xl space-y-3">
              <svg className="animate-spin h-6 w-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="text-slate-400 text-sm">Loading registered users...</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4 text-center">Role</th>
                      <th className="px-6 py-4 text-center">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0 shadow-sm">
                              {u.username ? u.username.charAt(0).toUpperCase() : "U"}
                            </div>
                            <span className="truncate max-w-[150px]">{u.username || "Anonymous"}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-400 font-mono text-xs">{u.email}</td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-medium border inline-block ${
                                u.role === "admin"
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                  : "bg-slate-800/80 border-slate-700 text-slate-400"
                              }`}
                            >
                              {u.role || "user"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="text-xs text-slate-400 font-mono">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-12 text-slate-500 text-xs">
                          No users matched your query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}