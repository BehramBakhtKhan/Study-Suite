"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { DocumentChatModal } from "@/components/DocumentChatModal";
import { useUploadPipeline } from "@/hooks/useUploadPipeline";

// Custom typewriter hook for features
function useTypewriter(words: string[], speed = 80, delay = 2000) {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (index >= words.length) {
      setIndex(0);
      return;
    }

    const currentWord = words[index];

    if (subIndex === currentWord.length + 1 && !isDeleting) {
      const timeout = setTimeout(() => setIsDeleting(true), delay);
      return () => clearTimeout(timeout);
    }

    if (subIndex === 0 && isDeleting) {
      setIsDeleting(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [subIndex, index, isDeleting, words, speed, delay]);

  return words[index].substring(0, subIndex);
}

export default function Homepage() {
  const {
    isDragging,
    selectedFile,
    uploadedDoc,
    generatedQuiz,
    isUploading,
    isGeneratingQuiz,
    activeError,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileChange,
    handleUploadAndSummarize,
    handleGenerateQuiz,
    resetPipeline,
  } = useUploadPipeline();

  const typedFeature = useTypewriter([
    "Instant AI Summaries",
    "Interactive Practice Quizzes",
    "Real-time AI Document Chat",
  ]);

  // Split summary into individual non-empty lines for highlighted rendering
  const summaryLines = uploadedDoc?.summary
    ? uploadedDoc.summary.split("\n").filter((line) => line.trim().length > 0)
    : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-x-hidden">
      <Sidebar />

      <main className="flex-1 ml-64 p-8 flex flex-col items-center justify-start min-h-screen">
        {/* Full-width container across the screen */}
        <div className="w-full max-w-6xl space-y-8">

          {/* Header Section with Typewriter Effect */}
          <div className="text-center space-y-3 pt-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Upload your document to get
            </h1>

            <div className="text-2xl sm:text-3xl font-bold h-10 flex items-center justify-center">
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent  decoration-indigo-500/30 decoration-wavy">
                {typedFeature}
              </span>
              <span className="inline-block w-[3px] h-7 ml-1 bg-indigo-500 animate-pulse align-middle" />
            </div>

            <p className="text-slate-400 text-sm max-w-lg mx-auto pt-1">
              Transform study materials into clear insights, automated quizzes, and interactive assistant responses instantly.
            </p>
          </div>

          {activeError && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {activeError}
            </div>
          )}

          {!uploadedDoc ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full border-2 border-dashed rounded-3xl p-16 text-center flex flex-col items-center justify-center transition-all duration-200 ${isDragging
                  ? "border-indigo-500 bg-indigo-500/10 scale-[1.005]"
                  : "border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900"
                }`}
            >
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center w-full">
                <div className="w-24 h-24 mb-6 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-indigo-400 shadow-xl transition-transform">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                  </svg>
                </div>

                <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Upload a file</h2>
                <p className="text-sm text-slate-400 max-w-sm mb-6">
                  Drag and drop a PDF document (max 5MB) to generate a summary.
                </p>

                <input
                  id="file-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <span className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/20">
                  Browse File
                </span>
              </label>

              {selectedFile && (
                <div className="mt-6 flex flex-col items-center gap-4 w-full max-w-md">
                  <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-indigo-300 font-mono w-full text-center">
                    Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </div>

                  <button
                    onClick={handleUploadAndSummarize}
                    disabled={isUploading}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 text-sm"
                  >
                    {isUploading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Parsing PDF & Summarizing...
                      </>
                    ) : (
                      "Upload & Generate Summary"
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Wide Processed Summary Container */
            <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white">{uploadedDoc.title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Summary generated by Gemini API</p>
                </div>
                <span className="text-xs px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  Processed
                </span>
              </div>

              {/* Individual Line Highlight Blocks */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-300">Key Document Summary</h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                  {summaryLines.length > 0 ? (
                    summaryLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 border-l-4 border-l-indigo-500 text-slate-200 text-sm leading-relaxed shadow-sm transition-colors hover:border-slate-700"
                      >
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-400 text-sm">
                      Summary unavailable for this document.
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  onClick={resetPipeline}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
                >
                  Upload Another File
                </button>

                {!generatedQuiz ? (
                  <button
                    onClick={handleGenerateQuiz}
                    disabled={isGeneratingQuiz}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                  >
                    {isGeneratingQuiz ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating Quiz...
                      </>
                    ) : (
                      "Create Quiz"
                    )}
                  </button>
                ) : (
                  <Link
                    href={`/quizzes/${generatedQuiz.id}`}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/20 transition-colors flex items-center gap-2"
                  >
                    Take Quiz &rarr;
                  </Link>
                )}
              </div>

              <DocumentChatModal documentId={uploadedDoc.id} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}