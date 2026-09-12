import { NextRequest } from "next/server";
import { GET } from "@/app/api/analytics/summary/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      count: jest.fn(),
    },
    quiz: {
      count: jest.fn(),
    },
    quizAttempt: {
      aggregate: jest.fn(),
    },
  },
}));

describe("GET /api/analytics/summary Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Missing Token
  it("should return 401 if accessToken cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/analytics/summary", {
      method: "GET",
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  // 2. Invalid Token
  it("should return 401 if JWT token verification fails", async () => {
    jest.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = new NextRequest("http://localhost/api/analytics/summary", {
      method: "GET",
      headers: { cookie: "accessToken=invalid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  // 3. Successful Aggregation Retrieval
  it("should return 200 with rounded averageScore and aggregated metrics", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    jest.mocked(prisma.document.count).mockResolvedValue(5);
    jest.mocked(prisma.quiz.count).mockResolvedValue(12);
    jest.mocked(prisma.quizAttempt.aggregate).mockResolvedValue({
      _count: { id: 8 },
      _avg: { score: 84.6 },
    } as never);

    const req = new NextRequest("http://localhost/api/analytics/summary", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({
      totalDocuments: 5,
      totalQuizzes: 12,
      totalAttempts: 8,
      averageScore: 85, // Math.round(84.6)
    });

    expect(prisma.document.count).toHaveBeenCalledWith({
      where: { userId: "user-101" },
    });
    expect(prisma.quiz.count).toHaveBeenCalledWith({
      where: { document: { userId: "user-101" } },
    });
    expect(prisma.quizAttempt.aggregate).toHaveBeenCalledWith({
      where: { userId: "user-101" },
      _count: { id: true },
      _avg: { score: true },
    });
  });

  // 4. Zero/Null Aggregation Values (User with no attempts)
  it("should default averageScore to 0 when _avg.score is null", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-102" } as never);

    jest.mocked(prisma.document.count).mockResolvedValue(0);
    jest.mocked(prisma.quiz.count).mockResolvedValue(0);
    jest.mocked(prisma.quizAttempt.aggregate).mockResolvedValue({
      _count: { id: 0 },
      _avg: { score: null },
    } as never);

    const req = new NextRequest("http://localhost/api/analytics/summary", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

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

  // 5. Database Promise Failure
  it("should return 500 if any database query in Promise.all fails", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    jest
      .mocked(prisma.document.count)
      .mockRejectedValue(new Error("Database connection error"));

    const req = new NextRequest("http://localhost/api/analytics/summary", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to fetch analytics");
  });
});