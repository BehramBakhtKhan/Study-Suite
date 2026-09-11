import { NextRequest } from "next/server";
import { GET, DELETE } from "@/app/api/quizzes/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    quiz: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe("API /api/quizzes Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // GET /api/quizzes
  describe("GET /api/quizzes", () => {
    it("should return 401 if access token cookie is missing", async () => {
      const req = new NextRequest("http://localhost/api/quizzes", {
        method: "GET",
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should return 401 if JWT token verification fails", async () => {
      jest.mocked(jwt.verify).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const req = new NextRequest("http://localhost/api/quizzes", {
        method: "GET",
        headers: { cookie: "accessToken=invalid_token" },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should return 200 with all user quizzes including document info and latest attempts", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

      const mockQuizzes = [
        {
          id: "quiz-1",
          title: "Operating Systems - Quiz #1",
          questions: [{ id: 1, question: "What is a process?" }],
          createdAt: new Date().toISOString(),
          document: {
            id: "doc-101",
            title: "OS Operating System Notes",
          },
          attempts: [
            {
              score: 5,
              totalQuestions: 5,
              submittedAt: new Date().toISOString(),
            },
          ],
        },
      ];

      jest.mocked(prisma.quiz.findMany).mockResolvedValue(mockQuizzes as never);

      const req = new NextRequest("http://localhost/api/quizzes", {
        method: "GET",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.quizzes).toHaveLength(1);
      expect(data.quizzes[0].id).toBe("quiz-1");
      expect(prisma.quiz.findMany).toHaveBeenCalledWith({
        where: {
          document: {
            userId: "user-101",
          },
        },
        select: expect.objectContaining({
          id: true,
          title: true,
          questions: true,
          createdAt: true,
        }),
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return 500 if database query fails", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
      jest
        .mocked(prisma.quiz.findMany)
        .mockRejectedValue(new Error("Database connection error"));

      const req = new NextRequest("http://localhost/api/quizzes", {
        method: "GET",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to fetch quizzes history");
    });
  });

  // DELETE /api/quizzes
  describe("DELETE /api/quizzes", () => {
    it("should return 401 if access token cookie is missing", async () => {
      const req = new NextRequest("http://localhost/api/quizzes", {
        method: "DELETE",
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should return 200 and delete all user quizzes successfully", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
      jest.mocked(prisma.quiz.deleteMany).mockResolvedValue({ count: 4 });

      const req = new NextRequest("http://localhost/api/quizzes", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("All quizzes deleted successfully");
      expect(data.count).toBe(4);
      expect(prisma.quiz.deleteMany).toHaveBeenCalledWith({
        where: {
          document: {
            userId: "user-101",
          },
        },
      });
    });

    it("should return 500 if database deletion fails", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
      jest
        .mocked(prisma.quiz.deleteMany)
        .mockRejectedValue(new Error("Failed to purge records"));

      const req = new NextRequest("http://localhost/api/quizzes", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to delete quizzes");
    });
  });
});