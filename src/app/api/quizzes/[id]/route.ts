import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

interface JwtPayload {
  userId: string;
}

// GET /api/quizzes/[id] - Fetch single quiz with questions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // 3. Fetch single quiz with ownership check via document relation
    const quiz = await prisma.quiz.findFirst({
      where: {
        id,
        document: {
          userId, // Ownership check
        },
      },
      select: {
        id: true,
        title: true,
        questions: true,
        documentId: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    return NextResponse.json({ quiz }, { status: 200 });
  } catch (error) {
    console.error("GET /api/quizzes/[id] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}