import { GET } from "@/app/api/analytics/summary/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

describe("API /api/analytics/summary Integration Tests", () => {
  let testUserId: string;
  let otherUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // 1. Seed primary user
    const user = await prisma.user.create({
      data: {
        username: "behramanalytics",
        email: "behramanalytics@gmail.com",
        passwordHash: "hashedpass123",
      },
    });
    testUserId = user.id;

    // 2. Seed secondary user for isolation tests
    const otherUser = await prisma.user.create({
      data: {
        username: "otheranalyticsuser",
        email: "otheranalyticsuser@gmail.com",
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
    const req = new NextRequest(
      "http://localhost:3000/api/analytics/summary",
      { method: "GET" }
    );

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 401 if access token is invalid or expired", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/analytics/summary",
      { method: "GET" }
    );
    req.cookies.set("accessToken", "invalid.jwt.token");

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  // ==========================================
  // Aggregation & Isolation Tests
  // ==========================================
  it("should return zeroed metrics for a user with no activity", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/analytics/summary",
      { method: "GET" }
    );
    req.cookies.set("accessToken", validToken);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      totalDocuments: 0,
      totalQuizzes: 0,
      totalAttempts: 0,
      averageScore: 0,
    });
  });

  it("should accurately calculate user metrics and ignore other users' data", async () => {
    // 1. Seed Primary User Activity (2 docs, 2 quizzes, 2 attempts: scores 8 and 9 => avg 8.5 rounded to 9)
    const doc1 = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "System Design Docs",
        filePath: "/uploads/sys.pdf",
        extractedText: "Scalability and Caching",
        textHash: "hash_analytics_doc1",
      },
    });

    const doc2 = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "Networking Basics",
        filePath: "/uploads/net.pdf",
        extractedText: "TCP/IP Protocol Stack",
        textHash: "hash_analytics_doc2",
      },
    });

    const quiz1 = await prisma.quiz.create({
      data: {
        documentId: doc1.id,
        title: "System Design Quiz",
        questions: [],
      },
    });

    await prisma.quiz.create({
      data: {
        documentId: doc2.id,
        title: "Networking Quiz",
        questions: [],
      },
    });

    await prisma.quizAttempt.createMany({
      data: [
        {
          userId: testUserId,
          quizId: quiz1.id,
          score: 8,
          totalQuestions: 10,
        },
        {
          userId: testUserId,
          quizId: quiz1.id,
          score: 9,
          totalQuestions: 10,
        },
      ],
    });

    // 2. Seed Secondary User Activity (Should NOT leak into response)
    const otherDoc = await prisma.document.create({
      data: {
        userId: otherUserId,
        title: "Other User PDF",
        filePath: "/uploads/other.pdf",
        extractedText: "Unrelated text",
        textHash: "hash_analytics_other",
      },
    });

    const otherQuiz = await prisma.quiz.create({
      data: {
        documentId: otherDoc.id,
        title: "Other Quiz",
        questions: [],
      },
    });

    await prisma.quizAttempt.create({
      data: {
        userId: otherUserId,
        quizId: otherQuiz.id,
        score: 2,
        totalQuestions: 10,
      },
    });

    // 3. Request Analytics
    const req = new NextRequest(
      "http://localhost:3000/api/analytics/summary",
      { method: "GET" }
    );
    req.cookies.set("accessToken", validToken);

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.totalDocuments).toBe(2);
    expect(data.totalQuizzes).toBe(2);
    expect(data.totalAttempts).toBe(2);
    expect(data.averageScore).toBe(9); // Math.round((8 + 9) / 2) = 9
  });
});