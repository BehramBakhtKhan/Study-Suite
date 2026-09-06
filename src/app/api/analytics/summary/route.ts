import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

interface JwtPayload {
  userId: string;
}

export async function GET(req: NextRequest) {
  try {
    // 1. Extract accessToken from HTTP-only cookie
    const token = req.cookies.get("accessToken")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    // 2. Verify JWT token
    let userId: string;
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || "your-secret-key"
      ) as JwtPayload;
      userId = decoded.userId;
    } catch {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    // 3. Parallel execution: PostgreSQL aggregates directly
    const [totalDocuments, totalQuizzes, attemptStats] = await Promise.all([
      prisma.document.count({ where: { userId } }),
      prisma.quiz.count({ where: { document: { userId } } }),
      prisma.quizAttempt.aggregate({
        where: { userId },
        _count: { id: true },
        _avg: { score: true },
      }),
    ]);

    const totalAttempts = attemptStats._count.id;
    const averageScore = Math.round(attemptStats._avg.score || 0);

    return NextResponse.json(
      {
        totalDocuments,
        totalQuizzes,
        totalAttempts,
        averageScore,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/analytics/summary Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}