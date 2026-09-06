"use client";

import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useQuizRunner } from "@/hooks/useQuizRunner";

interface QuizPageProps {
  params: Promise<{ id: string }>;
}

export default function QuizPage({ params }: QuizPageProps) {
  const {
    activeQuiz,
    questions,
    selectedAnswers,
    isSubmitting,
    submittedScore,
    isLoading,
    error,
    handleSelectOption,
    handleSubmit,
  } = useQuizRunner(params);

  if (isLoading && !activeQuiz) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-indigo-400">
            <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Loading quiz questions...</span>
          </div>
        </main>
      </div>
    );
  }

  if (error || !activeQuiz) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Quiz Not Found</h2>
          <p className="text-slate-400 mb-6">{error || "Could not load the requested quiz."}</p>
          <Link href="/" className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold">
            Back to Home
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex relative">
      <Sidebar />

      <main className="flex-1 ml-64 p-8 flex flex-col items-center min-h-screen">
        <div className="w-full max-w-3xl space-y-8 my-auto pb-12">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">{activeQuiz.title}</h1>
              <p className="text-xs text-slate-400 mt-1">
                {questions.length} Questions total
              </p>
            </div>
            {submittedScore !== null && (
              <div className="px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-semibold text-lg">
                Score: {submittedScore} / {questions.length}
              </div>
            )}
          </div>

          {/* Questions List */}
          <div className="space-y-6">
            {questions.map((q, qIndex) => {
              const qKey = q.id || String(qIndex);

              return (
                <div key={qKey} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-base font-semibold text-white flex gap-3">
                    <span className="text-indigo-400 font-mono">{qIndex + 1}.</span>
                    {q.text || (q as any).question}
                  </h3>

                  <div className="grid grid-cols-1 gap-2.5">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = selectedAnswers[qKey] === optIdx;

                      return (
                        <button
                          key={optIdx}
                          onClick={() => handleSelectOption(qKey, optIdx)}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all flex items-center justify-between ${isSelected
                              ? "border-indigo-500 bg-indigo-500/10 text-white font-medium"
                              : "border-slate-800 bg-slate-950/40 hover:bg-slate-800/50 text-slate-300"
                            }`}
                        >
                          <span>{opt}</span>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? "border-indigo-400 bg-indigo-500" : "border-slate-700"
                              }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Submission Toolbar */}
          <div className="flex justify-end pt-4">
            {submittedScore === null ? (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || Object.keys(selectedAnswers).length === 0}
                className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-all shadow-lg shadow-indigo-600/20"
              >
                {isSubmitting ? "Submitting..." : "Submit Quiz"}
              </button>
            ) : (
              <Link
                href="/quizzes"
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
              >
                Return to Dashboard
              </Link>
            )}
          </div>
        </div>
      </main>

      {/* Floating Bottom Right Score Badge */}
      {submittedScore !== null && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/90 border border-indigo-500/30 text-white shadow-2xl backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Final Result</span>
            <span className="text-base font-bold text-indigo-400">
              {submittedScore} <span className="text-xs text-slate-500">/ {questions.length}</span>
            </span>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            {Math.round((submittedScore / questions.length) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}