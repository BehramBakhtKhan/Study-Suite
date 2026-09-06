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
  AlertCircle,
  Download,
  BookOpen,
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
              href="/documents"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Documents
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex overflow-hidden relative">
      <Sidebar />

      <main className="flex-1 ml-64 h-screen flex flex-col overflow-y-auto custom-scrollbar">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link
              href="/documents"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Back to Documents"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h1 className="text-base font-bold text-white truncate max-w-lg">
                  {selectedDoc.title}
                </h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                Uploaded on {new Date(selectedDoc.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedDoc.filePath && (
              <a
                href={selectedDoc.filePath}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors border border-slate-700/50"
              >
                <Download className="w-3.5 h-3.5" /> View PDF File
              </a>
            )}
            <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-medium">
              Document Summary
            </span>
          </div>
        </header>

        {/* Content Container */}
        <div className="max-w-5xl w-full mx-auto p-8 space-y-6">
          {/* Status Indicator Banner */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Document Processed</h3>
                <p className="text-xs text-slate-400">
                  Full context has been indexed. Use the floating Ask AI button to start chatting.
                </p>
              </div>
            </div>
          </div>

          {/* AI Summary Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-xl">
            <div className="flex items-center gap-2 text-indigo-400 border-b border-slate-800/80 pb-4">
              <Sparkles className="w-5 h-5" />
              <h2 className="text-lg font-bold text-white">AI Overview & Summary</h2>
            </div>

            <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-line bg-slate-950/60 p-6 rounded-2xl border border-slate-800/80">
              {selectedDoc.summary || "No summary generated for this document."}
            </div>
          </div>
        </div>

        {/* Floating AI Chat Modal Button */}
        <DocumentChatModal documentId={id} />
      </main>
    </div>
  );
}