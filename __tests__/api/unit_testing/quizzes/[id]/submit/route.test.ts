import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// 1. Persistent mock function for Gemini
const mockGenerateContent = jest.fn();

// 2. Mock @google/genai module
jest.mock("@google/genai", () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
      },
    })),
  };
});

// Import route AFTER mocking
import { POST } from "@/app/api/quizzes/[id]/submit/route";
import { prisma } from "@/lib/prisma";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    quiz: {
      findUnique: jest.fn(),
    },
    quizAttempt: {
      create: jest.fn(),
    },
  },
}));

describe("POST /api/quizzes/[id]/submit Unit Tests", () => {
  const mockParams = Promise.resolve({ id: "quiz-123" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Authentication & Payload Validation
  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      body: JSON.stringify({ userAnswers: [0, 1] }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 401 if JWT token verification fails", async () => {
    jest.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      headers: { cookie: "accessToken=invalid_token" },
      body: JSON.stringify({ userAnswers: [0, 1] }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 400 if JSON body is malformed", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: "{ invalid_json ",
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("should return 400 if body fails Zod schema validation", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ userAnswers: "not-an-array" }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid submission data");
    expect(data.details).toBeDefined();
  });

  // 2. Resource Existence Check
  it("should return 404 if quiz does not exist", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.quiz.findUnique).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ userAnswers: [0, 1] }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Quiz not found");
  });

  // 3. Perfect Score (No AI Call)
  it("should calculate a perfect score and bypass Gemini feedback call", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockQuiz = {
      id: "quiz-123",
      title: "Data Structures Quiz",
      questions: [
        {
          id: 1,
          question: "Stack works on?",
          options: ["LIFO", "FIFO"],
          correctAnswerIndex: 0,
        },
        {
          id: 2,
          question: "Queue works on?",
          options: ["LIFO", "FIFO"],
          correctAnswerIndex: 1,
        },
      ],
    };

    jest.mocked(prisma.quiz.findUnique).mockResolvedValue(mockQuiz as never);

    const mockAttempt = {
      id: "attempt-1",
      userId: "user-101",
      quizId: "quiz-123",
      score: 2,
      totalQuestions: 2,
      aiFeedback: "Perfect score! Outstanding work.",
    };

    jest.mocked(prisma.quizAttempt.create).mockResolvedValue(mockAttempt as never);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ userAnswers: [0, 1] }), // Both correct
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.attempt.score).toBe(2);
    expect(data.attempt.aiFeedback).toBe("Perfect score! Outstanding work.");
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  // 4. Imperfect Score with AI Feedback
  it("should calculate partial score, generate Gemini AI feedback, and save attempt", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockQuiz = {
      id: "quiz-123",
      title: "Operating Systems",
      questions: [
        {
          id: 1,
          question: "What is deadlock?",
          options: ["Resource lock", "Memory leak", "Thread pool"],
          correctAnswerIndex: 0,
          explanation: "Deadlock happens when processes block each other.",
        },
        {
          id: 2,
          question: "What is paging?",
          options: ["Memory management", "Disk format"],
          correctAnswerIndex: 0,
          explanation: "Paging avoids external fragmentation.",
        },
      ],
    };

    jest.mocked(prisma.quiz.findUnique).mockResolvedValue(mockQuiz as never);
    mockGenerateContent.mockResolvedValueOnce({
      text: "- Review process synchronization.\n- Study paging vs segmentation.",
    });

    const mockAttempt = {
      id: "attempt-2",
      userId: "user-101",
      quizId: "quiz-123",
      score: 1,
      totalQuestions: 2,
      aiFeedback: "- Review process synchronization.\n- Study paging vs segmentation.",
    };

    jest.mocked(prisma.quizAttempt.create).mockResolvedValue(mockAttempt as never);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ userAnswers: [1, 0] }), // First wrong (1), Second correct (0)
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(prisma.quizAttempt.create).toHaveBeenCalledWith({
      data: {
        userId: "user-101",
        quizId: "quiz-123",
        score: 1,
        totalQuestions: 2,
        aiFeedback: "- Review process synchronization.\n- Study paging vs segmentation.",
      },
    });
    expect(data.attempt.score).toBe(1);
  });

  // 5. Fallback AI Feedback on Error
  it("should use fallback feedback string when Gemini API throws an exception", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockQuiz = {
      id: "quiz-123",
      title: "Networking",
      questions: [
        {
          id: 1,
          question: "HTTP port?",
          options: ["21", "80"],
          correctAnswerIndex: 1,
        },
      ],
    };

    jest.mocked(prisma.quiz.findUnique).mockResolvedValue(mockQuiz as never);
    mockGenerateContent.mockRejectedValueOnce(new Error("API rate limit exceeded"));

    const mockAttempt = {
      id: "attempt-3",
      userId: "user-101",
      quizId: "quiz-123",
      score: 0,
      totalQuestions: 1,
      aiFeedback: "Good effort! Review the document sections covering the missed questions.",
    };

    jest.mocked(prisma.quizAttempt.create).mockResolvedValue(mockAttempt as never);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123/submit", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ userAnswers: [0] }), // Wrong answer
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.attempt.aiFeedback).toBe(
      "Good effort! Review the document sections covering the missed questions."
    );
  });
});