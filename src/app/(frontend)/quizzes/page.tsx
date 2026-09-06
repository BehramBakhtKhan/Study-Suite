"use client";

import { useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useQuizStore } from "@/store/useQuizStore";
import toast from "react-hot-toast";

export default function QuizzesPage() {
  const { quizzes, fetchQuizzes, deleteAllQuizzes, isLoading, error } = useQuizStore();

  useEffect(() => {
    fetchQuizzes();
  }, []); // Run once on mount

  const handleDeleteAllQuizzes = async () => {
    if (confirm("Are you sure you want to delete all quizzes? This action cannot be undone.")) {
      await deleteAllQuizzes();
      toast.success("All quizzes deleted successfully.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 min-h-screen">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-5">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                All Quizzes
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Select a quiz generated from your uploaded study documents to start practicing.
              </p>
            </div>
            <button
              onClick={handleDeleteAllQuizzes}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors hover:shadow-sm hover:shadow-white cursor-pointer flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
             Delete All Quizzes
            </button>
          </div>

          {/* Error Message */}
          {error && (
            toast.error(error)
          )}

          {/* Loading Skeleton */}
          {isLoading && quizzes.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-48 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse p-6 flex flex-col justify-between"
                >
                  <div className="h-6 bg-slate-800 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-800 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            /* Empty State */
            <div className="border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 mb-4 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-8 h-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">
                No quizzes available
              </h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm">
                Upload a document on the home page to automatically generate your first practice quiz.
              </p>
              <Link
                href="/homepage"
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors"
              >
                Go to Home Page
              </Link>
            </div>
          ) : (
            /* Quiz Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M12 18h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {quiz.questions?.length || 0} Questions
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                      {quiz.title}
                    </h2>

                    <p className="text-xs text-slate-400">
                      Created on{" "}
                      {new Date(quiz.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className="w-full text-center py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-md shadow-indigo-600/10"
                    >
                      Take Quiz
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}