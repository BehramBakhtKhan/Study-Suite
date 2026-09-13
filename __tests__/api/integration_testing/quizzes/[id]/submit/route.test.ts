import { POST } from "@/app/api/quizzes/[id]/submit/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

// Mock Gemini SDK
jest.mock("@google/genai", () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: "• Review key concepts on B-Tree index structures versus Hash indexes.\n• Focus on how ranges are traversed.",
        }),
      },
    })),
  };
});

describe("API /api/quizzes/[id]/submit Integration Tests", () => {
  let testUserId: string;
  let validToken: string;
  let testQuizId: string;

  beforeEach(async () => {
    // 1. Seed user
    const user = await prisma.user.create({
      data: {
        username: "behramsubmit",
        email: "behramsubmit@gmail.com",
        passwordHash: "hashedpass123",
      },
    });
    testUserId = user.id;

    // 2. Seed document and quiz with structured questions
    const doc = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "Database Indexing Deep Dive",
        filePath: "/uploads/db_indexing.pdf",
        extractedText: "Indexing concepts and strategies.",
        textHash: "hash_db_indexing_submit",
      },
    });

    const quiz = await prisma.quiz.create({
      data: {
        documentId: doc.id,
        title: "Database Indexing Deep Dive - Quiz #1",
        questions: [
          {
            id: 1,
            question: "Which index type is optimal for range queries?",
            options: ["Hash Index", "B-Tree Index"],
            correctAnswerIndex: 1,
            explanation: "B-Trees keep keys sorted, ideal for range queries.",
          },
          {
            id: 2,
            question: "What is the primary lookup complexity of a Hash index?",
            options: ["O(1)", "O(log N)", "O(N)"],
            correctAnswerIndex: 0,
            explanation: "Hash indexes offer O(1) average lookup complexity.",
          },
        ],
      },
    });
    testQuizId = quiz.id;

    // 3. Sign JWT
    validToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );
  });

  // ==========================================
  // Auth & Request Validation Tests
  // ==========================================
  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/quizzes/${testQuizId}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ userAnswers: [1, 0] }),
      }
    );

    const params = Promise.resolve({ id: testQuizId });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 400 if JSON body is malformed", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/quizzes/${testQuizId}/submit`,
      {
        method: "POST",
        body: "invalid-json-payload",
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: testQuizId });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("should return 400 if userAnswers payload is missing or invalid", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/quizzes/${testQuizId}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ userAnswers: "not-an-array" }),
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: testQuizId });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid submission data");
    expect(data.details).toBeDefined();
  });

  it("should return 404 if target quiz does not exist", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/quizzes/non-existent-quiz-id/submit",
      {
        method: "POST",
        body: JSON.stringify({ userAnswers: [1, 0] }),
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: "non-existent-quiz-id" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Quiz not found");
  });

  // ==========================================
  // Scoring & AI Feedback Execution
  // ==========================================
  it("should calculate a perfect score (2/2) and set default perfect AI feedback", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/quizzes/${testQuizId}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ userAnswers: [1, 0] }), // Both correct
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: testQuizId });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.attempt).toBeDefined();
    expect(data.attempt.score).toBe(2);
    expect(data.attempt.totalQuestions).toBe(2);
    expect(data.attempt.aiFeedback).toBe("Perfect score! Outstanding work.");

    // Verify record saved in database
    const dbAttempt = await prisma.quizAttempt.findUnique({
      where: { id: data.attempt.id },
    });
    expect(dbAttempt).not.toBeNull();
    expect(dbAttempt?.score).toBe(2);
  });

  it("should calculate a partial score (1/2), trigger AI feedback, and persist result", async () => {
    const req = new NextRequest(
      `http://localhost:3000/api/quizzes/${testQuizId}/submit`,
      {
        method: "POST",
        body: JSON.stringify({ userAnswers: [0, 0] }), // First option wrong (0 instead of 1), second correct
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: testQuizId });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.attempt).toBeDefined();
    expect(data.attempt.score).toBe(1);
    expect(data.attempt.totalQuestions).toBe(2);
    expect(data.attempt.aiFeedback).toContain("Review key concepts on B-Tree index structures");

    // Verify record saved in database
    const dbAttempt = await prisma.quizAttempt.findUnique({
      where: { id: data.attempt.id },
    });
    expect(dbAttempt).not.toBeNull();
    expect(dbAttempt?.score).toBe(1);
  });
});