import { create } from "zustand";
import { api } from "@/lib/axios";

export interface Document {
  id: string;
  title: string;
  filePath?: string;
  summary?: string | null;
  extractedText?: string;
  createdAt: string;
}

interface DocState {
  documents: Document[];
  selectedDoc: Document | null;
  isLoading: boolean;
  error: string | null;

  fetchDocuments: () => Promise<void>;
  fetchDocumentById: (id: string) => Promise<Document | null>;
  uploadDocument: (formData: FormData) => Promise<Document>;
  summarizeDocument: (id: string) => Promise<string>;
  selectDocument: (doc: Document | null) => void;
  deleteDocument: (id: string) => Promise<void>;
  deleteAllDocuments: () => Promise<void>;
  sendDocumentChatMessage: (
    documentId: string,
    question: string
  ) => Promise<string>;
  clearError: () => void;
}

export const useDocStore = create<DocState>((set) => ({
  documents: [],
  selectedDoc: null,
  isLoading: false,
  error: null,

  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get("/documents");
      const fetchedDocs: Document[] = res.data.documents || [];

      set({
        // Deduplicate fetched array directly in case the API returns duplicates
        documents: fetchedDocs.filter(
          (doc, index, self) => index === self.findIndex((d) => d.id === doc.id)
        ),
        isLoading: false,
      });
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to fetch documents",
        isLoading: false,
      });
    }
  },

  fetchDocumentById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/documents/${id}`);
      const fetchedDoc = res.data.document || res.data;

      set({ selectedDoc: fetchedDoc, isLoading: false });
      return fetchedDoc;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to fetch document";
      set({ error: errorMsg, isLoading: false });
      return null;
    }
  },

  uploadDocument: async (formData: FormData) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post("/documents", formData);
      const uploadedDoc: Document = res.data.document;

      set((state) => {
        // Check if document already exists to avoid duplicate render keys
        const exists = state.documents.some((d) => d.id === uploadedDoc.id);
        const updatedList = exists
          ? state.documents.map((d) => (d.id === uploadedDoc.id ? uploadedDoc : d))
          : [uploadedDoc, ...state.documents];

        return {
          documents: updatedList,
          selectedDoc: uploadedDoc,
          isLoading: false,
        };
      });

      return uploadedDoc;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to upload document";
      set({ error: errorMsg, isLoading: false });
      throw new Error(errorMsg);
    }
  },

  summarizeDocument: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post(`/documents/${id}/summarize`);
      const summary = res.data.summary;

      set((state) => ({
        documents: state.documents.map((doc) =>
          doc.id === id ? { ...doc, summary } : doc
        ),
        selectedDoc:
          state.selectedDoc?.id === id
            ? { ...state.selectedDoc, summary }
            : state.selectedDoc,
        isLoading: false,
      }));

      return summary;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to generate summary";
      set({ error: errorMsg, isLoading: false });
      throw new Error(errorMsg);
    }
  },

  selectDocument: (doc) => set({ selectedDoc: doc }),

  deleteDocument: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/documents/${id}`);
      set((state) => ({
        documents: state.documents.filter((d) => d.id !== id),
        selectedDoc: state.selectedDoc?.id === id ? null : state.selectedDoc,
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        error: err.response?.data?.error || "Failed to delete document",
        isLoading: false,
      });
    }
  },

  deleteAllDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.delete("/documents");
      set({
        documents: [],
        selectedDoc: null,
        isLoading: false,
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to delete all documents";
      set({ error: errorMsg, isLoading: false });
      throw new Error(errorMsg);
    }
  },

  sendDocumentChatMessage: async (documentId: string, question: string) => {
    try {
      const response = await api.post(`/documents/${documentId}/chat`, {
        question,
      });
      return response.data.answer;
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to fetch response";
      throw new Error(errorMsg);
    }
  },

  clearError: () => set({ error: null }),
}));