import { NextRequest } from "next/server";
import { GET } from "@/app/api/quizzes/[id]/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    quiz: {
      findFirst: jest.fn(),
    },
  },
}));

describe("GET /api/quizzes/[id] Unit Tests", () => {
  const mockParams = Promise.resolve({ id: "quiz-123" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 if accessToken cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/quizzes/quiz-123", {
      method: "GET",
    });

    const res = await GET(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 401 if JWT token verification fails", async () => {
    jest.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123", {
      method: "GET",
      headers: { cookie: "accessToken=invalid_token" },
    });

    const res = await GET(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 404 if quiz is not found or does not belong to user", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.quiz.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Quiz not found");
    expect(prisma.quiz.findFirst).toHaveBeenCalledWith({
      where: {
        id: "quiz-123",
        document: {
          userId: "user-101",
        },
      },
      select: {
        id: true,
        title: true,
        questions: true,
        documentId: true,
      },
    });
  });

  it("should return 200 with quiz details when found", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockQuiz = {
      id: "quiz-123",
      title: "Data Structures - Quiz #1",
      questions: [
        {
          id: 1,
          question: "What is the time complexity of array lookup by index?",
          options: ["O(1)", "O(n)", "O(log n)", "O(n^2)"],
          correctAnswerIndex: 0,
          explanation: "Array memory addresses are calculated directly.",
        },
      ],
      documentId: "doc-999",
    };

    jest.mocked(prisma.quiz.findFirst).mockResolvedValue(mockQuiz as never);

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.quiz).toEqual(mockQuiz);
  });

  it("should return 500 if database operation fails", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest
      .mocked(prisma.quiz.findFirst)
      .mockRejectedValue(new Error("Database connection error"));

    const req = new NextRequest("http://localhost/api/quizzes/quiz-123", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to fetch quiz");
  });
});