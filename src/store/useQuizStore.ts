import { create } from "zustand";
import { api } from "@/lib/axios";

export interface Question {
  id: string;
  quizId?: string;
  question?: string; // Matching API schema
  text?: string;
  options: string[];
  correctAnswerIndex?: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  score: number;
  totalQuestions: number;
  aiFeedback?: string;
  userAnswers?: number[] | Record<string, number>;
  createdAt: string;
}

export interface Quiz {
  id: string;
  documentId: string;
  title: string;
  questions?: Question[];
  attempts?: QuizAttempt[];
  createdAt: string;
}

interface QuizState {
  quizzes: Quiz[];
  activeQuiz: Quiz | null;
  attempts: QuizAttempt[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchQuizzes: () => Promise<void>;
  fetchQuizById: (id: string) => Promise<Quiz | null>;
  createQuiz: (documentId: string, numQuestions?: number) => Promise<Quiz>;
  deleteAllQuizzes: () => Promise<void>;
  submitQuizAttempt: (
    quizId: string,
    questions: Question[],
    answersMap: Record<string, number>
  ) => Promise<QuizAttempt>;
  fetchUserAttempts: () => Promise<void>;
  resetActiveQuiz: () => void;
  clearError: () => void;
}

export const useQuizStore = create<QuizState>((set) => ({
  quizzes: [],
  activeQuiz: null,
  attempts: [],
  isLoading: false,
  error: null,

  // 1. Fetch all quizzes for the authenticated user
  fetchQuizzes: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/quizzes");
      set({
        quizzes: response.data.quizzes || response.data,
        isLoading: false,
      });
    } catch (err: any) {
      const is401 = err.response?.status === 401;
      set({
        // Suppress display banner on 401 unauthenticated requests
        error: is401 ? null : err.response?.data?.error || "Failed to fetch quizzes",
        isLoading: false,
      });
    }
  },

  // 2. Fetch a single quiz with questions by ID (GET /api/quizzes/[id])
  fetchQuizById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/quizzes/${id}`);
      const quiz = response.data.quiz || response.data;
      set({ activeQuiz: quiz, isLoading: false });
      return quiz;
    } catch (err: any) {
      const is401 = err.response?.status === 401;
      const errorMessage = is401 ? null : err.response?.data?.error || "Failed to fetch quiz";
      set({ error: errorMessage, isLoading: false });
      return null;
    }
  },

  // 3. Generate a new quiz for a document (POST /api/documents/[id]/quiz)
  createQuiz: async (documentId: string, numQuestions = 5) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/documents/${documentId}/quiz`, {
        numQuestions,
      });
      const newQuiz: Quiz = response.data.quiz || response.data;

      set((state) => ({
        quizzes: [newQuiz, ...state.quizzes],
        activeQuiz: newQuiz,
        isLoading: false,
      }));

      return newQuiz;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Failed to generate quiz";
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // 4. Delete all quizzes for the authenticated user (DELETE /api/quizzes)
  deleteAllQuizzes: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.delete("/quizzes");
      set({
        quizzes: [],
        activeQuiz: null,
        isLoading: false,
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Failed to delete quizzes";
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // 5. Submit attempt answers for a quiz (POST /api/quizzes/[id]/submit)
  submitQuizAttempt: async (
    quizId: string,
    questions: Question[],
    answersMap: Record<string, number>
  ) => {
    set({ isLoading: true, error: null });
    try {
      const userAnswers = questions.map((q, idx) => {
        const key = q.id || String(idx);
        return answersMap[key] ?? -1;
      });

      const response = await api.post(`/quizzes/${quizId}/submit`, {
        userAnswers,
      });

      const newAttempt: QuizAttempt = response.data.attempt || response.data;

      set((state) => ({
        attempts: [newAttempt, ...state.attempts],
        isLoading: false,
      }));

      return newAttempt;
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || "Failed to submit quiz attempt";
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  // 6. Fetch all user quiz attempts (GET /api/quizzes/attempts)
  fetchUserAttempts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/quizzes/attempts");
      set({
        attempts: response.data.attempts || response.data,
        isLoading: false,
      });
    } catch (err: any) {
      const is401 = err.response?.status === 401;
      set({
        error: is401 ? null : err.response?.data?.error || "Failed to fetch quiz attempts",
        isLoading: false,
      });
    }
  },

  // Clear active quiz state or error banner manually
  resetActiveQuiz: () => set({ activeQuiz: null, error: null }),
  clearError: () => set({ error: null }),
}));