import { GET } from "@/app/api/quizzes/[id]/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

describe("API /api/quizzes/[id] Integration Tests", () => {
  let testUserId: string;
  let otherUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // 1. Seed primary user
    const user = await prisma.user.create({
      data: {
        username: "behramsinglequiz",
        email: "behramsinglequiz@gmail.com",
        passwordHash: "hashedpass123",
      },
    });
    testUserId = user.id;

    // 2. Seed secondary user for isolation tests
    const otherUser = await prisma.user.create({
      data: {
        username: "othersinglequizuser",
        email: "othersinglequizuser@gmail.com",
        passwordHash: "hashedpass123",
      },
    });
    otherUserId = otherUser.id;

    // 3. Sign JWT
    validToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );
  });

  // ==========================================
  // Auth Tests
  // ==========================================
  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/quizzes/quiz-123", {
      method: "GET",
    });

    const params = Promise.resolve({ id: "quiz-123" });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 401 if access token is invalid or expired", async () => {
    const req = new NextRequest("http://localhost:3000/api/quizzes/quiz-123", {
      method: "GET",
    });
    req.cookies.set("accessToken", "invalid.jwt.token");

    const params = Promise.resolve({ id: "quiz-123" });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  // ==========================================
  // Database & Ownership Tests
  // ==========================================
  it("should return 404 if quiz does not exist in database", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/quizzes/non-existent-quiz-id",
      { method: "GET" }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: "non-existent-quiz-id" });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Quiz not found");
  });

  it("should return 404 if trying to fetch another user's quiz", async () => {
    // Seed document & quiz for secondary user
    const otherDoc = await prisma.document.create({
      data: {
        userId: otherUserId,
        title: "Other User Document",
        filePath: "/uploads/other_doc.pdf",
        extractedText: "Private notes",
        textHash: "hash_other_single_quiz",
      },
    });

    const otherQuiz = await prisma.quiz.create({
      data: {
        documentId: otherDoc.id,
        title: "Other User Quiz - Quiz #1",
        questions: [],
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/quizzes/${otherQuiz.id}`,
      { method: "GET" }
    );
    req.cookies.set("accessToken", validToken); // Auth as testUserId

    const params = Promise.resolve({ id: otherQuiz.id });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Quiz not found");
  });

  // ==========================================
  // Success Flow Test
  // ==========================================
  it("should return 200 and single quiz payload when authorized", async () => {
    const userDoc = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "Database Indexing",
        filePath: "/uploads/db_indexing.pdf",
        extractedText: "B-Tree and Hash Indexing concepts",
        textHash: "hash_db_indexing_single_quiz",
      },
    });

    const mockQuestions = [
      {
        id: 1,
        question: "Which index type supports range queries?",
        options: ["Hash Index", "B-Tree Index"],
        correctAnswerIndex: 1,
        explanation: "B-Trees maintain ordered keys ideal for range scans.",
      },
    ];

    const userQuiz = await prisma.quiz.create({
      data: {
        documentId: userDoc.id,
        title: "Database Indexing - Quiz #1",
        questions: mockQuestions,
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/quizzes/${userQuiz.id}`,
      { method: "GET" }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: userQuiz.id });
    const res = await GET(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.quiz).toBeDefined();
    expect(data.quiz.id).toBe(userQuiz.id);
    expect(data.quiz.title).toBe("Database Indexing - Quiz #1");
    expect(data.quiz.documentId).toBe(userDoc.id);
    expect(data.quiz.questions).toEqual(mockQuestions);
  });
});