import { GET, DELETE } from "@/app/api/quizzes/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

describe("API /api/quizzes Integration Tests", () => {
  let testUserId: string;
  let otherUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // 1. Seed primary user
    const user = await prisma.user.create({
      data: {
        username: "behramquizzes",
        email: "behramquizzes@gmail.com",
        passwordHash: "hashedpass123",
      },
    });
    testUserId = user.id;

    // 2. Seed secondary user for isolation testing
    const otherUser = await prisma.user.create({
      data: {
        username: "otherquizzesuser",
        email: "otherquizzesuser@gmail.com",
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
  // GET /api/quizzes
  // ==========================================
  describe("GET /api/quizzes", () => {
    it("should return 401 if access token cookie is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/quizzes", {
        method: "GET",
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should return empty array if authenticated user has no quizzes", async () => {
      const req = new NextRequest("http://localhost:3000/api/quizzes", {
        method: "GET",
      });
      req.cookies.set("accessToken", validToken);

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.quizzes).toEqual([]);
    });

    it("should return only the quizzes belonging to the authenticated user with latest attempt data", async () => {
      // Primary user document & quiz
      const userDoc = await prisma.document.create({
        data: {
          userId: testUserId,
          title: "Operating Systems Notes",
          filePath: "/uploads/os.pdf",
          extractedText: "OS Concepts",
          textHash: "os_hash_root_quiz",
        },
      });

      const userQuiz = await prisma.quiz.create({
        data: {
          documentId: userDoc.id,
          title: "Operating Systems Notes - Quiz #1",
          questions: [
            {
              id: 1,
              question: "What is a process?",
              options: ["Program in execution", "Hardware device"],
              correctAnswerIndex: 0,
              explanation: "A process is a program in execution.",
            },
          ],
        },
      });

      // Create two attempts (without non-existent `answers` key)
      await prisma.quizAttempt.create({
        data: {
          quizId: userQuiz.id,
          userId: testUserId,
          score: 1,
          totalQuestions: 1,
          submittedAt: new Date("2026-09-01T10:00:00Z"),
        },
      });

      const latestAttempt = await prisma.quizAttempt.create({
        data: {
          quizId: userQuiz.id,
          userId: testUserId,
          score: 1,
          totalQuestions: 1,
          submittedAt: new Date("2026-09-10T12:00:00Z"),
        },
      });

      // Secondary user document & quiz (Should NOT be returned)
      const otherDoc = await prisma.document.create({
        data: {
          userId: otherUserId,
          title: "Other User Doc",
          filePath: "/uploads/other.pdf",
          extractedText: "Other content",
          textHash: "other_hash_root_quiz",
        },
      });

      await prisma.quiz.create({
        data: {
          documentId: otherDoc.id,
          title: "Other User - Quiz #1",
          questions: [],
        },
      });

      const req = new NextRequest("http://localhost:3000/api/quizzes", {
        method: "GET",
      });
      req.cookies.set("accessToken", validToken);

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.quizzes.length).toBe(1);
      expect(data.quizzes[0].id).toBe(userQuiz.id);
      expect(data.quizzes[0].document.title).toBe("Operating Systems Notes");
      expect(data.quizzes[0].attempts.length).toBe(1);
      expect(new Date(data.quizzes[0].attempts[0].submittedAt).toISOString()).toBe(
        latestAttempt.submittedAt.toISOString()
      );
    });
  });

  // ==========================================
  // DELETE /api/quizzes
  // ==========================================
  describe("DELETE /api/quizzes", () => {
    it("should return 401 if access token cookie is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/quizzes", {
        method: "DELETE",
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should delete all quizzes for the authenticated user while ignoring other users' quizzes", async () => {
      // Primary user document & quiz
      const userDoc = await prisma.document.create({
        data: {
          userId: testUserId,
          title: "User Document",
          filePath: "/uploads/user_doc.pdf",
          extractedText: "Text",
          textHash: "hash_user_doc",
        },
      });

      await prisma.quiz.createMany({
        data: [
          { documentId: userDoc.id, title: "Quiz 1", questions: [] },
          { documentId: userDoc.id, title: "Quiz 2", questions: [] },
        ],
      });

      // Other user document & quiz
      const otherDoc = await prisma.document.create({
        data: {
          userId: otherUserId,
          title: "Other Document",
          filePath: "/uploads/other_doc.pdf",
          extractedText: "Text",
          textHash: "hash_other_doc",
        },
      });

      const otherQuiz = await prisma.quiz.create({
        data: {
          documentId: otherDoc.id,
          title: "Other User Quiz",
          questions: [],
        },
      });

      const req = new NextRequest("http://localhost:3000/api/quizzes", {
        method: "DELETE",
      });
      req.cookies.set("accessToken", validToken);

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("All quizzes deleted successfully");
      expect(data.count).toBe(2);

      // Verify DB state
      const remainingUserQuizzes = await prisma.quiz.findMany({
        where: { document: { userId: testUserId } },
      });
      expect(remainingUserQuizzes.length).toBe(0);

      const remainingOtherQuiz = await prisma.quiz.findUnique({
        where: { id: otherQuiz.id },
      });
      expect(remainingOtherQuiz).not.toBeNull();
    });
  });
});