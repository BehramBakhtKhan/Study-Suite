import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

interface JwtPayload {
  userId: string;
}

// Helper to authenticate user from cookies
function getUserIdFromRequest(req: NextRequest): string | null {
  const token = req.cookies.get("accessToken")?.value;
  if (!token) return null;

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    ) as JwtPayload;
    return decoded.userId;
  } catch {
    return null;
  }
}

// GET /api/quizzes - Fetch all quizzes for the authenticated user
export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    // Fetch quizzes associated with the authenticated user's documents
    const quizzes = await prisma.quiz.findMany({
      where: {
        document: {
          userId,
        },
      },
      select: {
        id: true,
        title: true,
        questions: true, // Selects the JSON array directly
        createdAt: true,
        document: {
          select: {
            id: true,
            title: true,
          },
        },
        attempts: {
          where: { userId },
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: {
            score: true,
            totalQuestions: true,
            submittedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ quizzes }, { status: 200 });
  } catch (error) {
    console.error("GET /api/quizzes Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes history" },
      { status: 500 }
    );
  }
}

// DELETE /api/quizzes - Delete all quizzes for the authenticated user
export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    // Delete all quizzes connected to documents owned by this user
    const result = await prisma.quiz.deleteMany({
      where: {
        document: {
          userId,
        },
      },
    });

    return NextResponse.json(
      {
        message: "All quizzes deleted successfully",
        count: result.count,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/quizzes Error:", error);
    return NextResponse.json(
      { error: "Failed to delete quizzes" },
      { status: 500 }
    );
  }
}