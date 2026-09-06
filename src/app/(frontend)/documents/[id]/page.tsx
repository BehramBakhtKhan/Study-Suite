"use client";

import { useEffect, use } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { useDocStore } from "@/store/useDocStore";
import { DocumentChatModal } from "@/components/DocumentChatModal";
import {
  Loader2,
  ArrowLeft,
  FileText,
  Calendar,
  Sparkles,
  AlignLeft,
  AlertCircle
} from "lucide-react";

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { selectedDoc, fetchDocumentById, isLoading, error } = useDocStore();

  useEffect(() => {
    if (id) {
      fetchDocumentById(id);
    }
  }, [id, fetchDocumentById]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-slate-400">Loading document details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error || !selectedDoc) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center p-8">
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center max-w-md space-y-4">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Unable to load document</h2>
            <p className="text-sm text-slate-400">{error || "Document not found"}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden">
      <Sidebar />

      <main className="flex-1 ml-64 h-screen flex flex-col">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h1 className="text-base font-bold text-white truncate max-w-md">
                  {selectedDoc.title}
                </h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3" />
                Uploaded on {new Date(selectedDoc.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
            Active Workspace
          </span>
        </header>

        {/* Full-Screen Workspace Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden">

          {/* Left Column: Document Summary & Extracted Content */}
          <div className="lg:col-span-7 p-6 overflow-y-auto space-y-6 border-r border-slate-800/80">
            {/* Summary Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-800/80 pb-3">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-lg font-bold text-white">AI Summary</h2>
              </div>
              <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80">
                {selectedDoc.summary || "No summary generated for this document."}
              </div>
            </div>

            {/* Extracted Text Card */}
            {selectedDoc.extractedText && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-slate-400 border-b border-slate-800/80 pb-3">
                  <AlignLeft className="w-5 h-5" />
                  <h2 className="text-base font-semibold text-white">Extracted Text Content</h2>
                </div>
                <div className="max-h-96 overflow-y-auto text-xs text-slate-400 font-mono leading-relaxed whitespace-pre-wrap bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 custom-scrollbar">
                  {selectedDoc.extractedText}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Embedded Chat Terminal */}
          <div className="lg:col-span-5 bg-slate-900/30 flex flex-col h-full overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Document Assistant
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Gemini 2.5 Flash</span>
            </div>

            {/* Full-height Chat Container */}
            <div className="flex-1 overflow-hidden p-4">
              <DocumentChatModal documentId={id} />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}