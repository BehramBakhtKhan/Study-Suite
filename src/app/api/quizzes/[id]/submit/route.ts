import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const submitSchema = z.object({
  // Array of user selected indices matching the question order
  userAnswers: z.array(z.number().int()),
});

interface JwtPayload {
  userId: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quizId } = await params;

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

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = submitSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid submission data", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { userAnswers } = validation.data;

    // 3. Fetch quiz from database
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { document: true },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const questions = quiz.questions as Array<{
      id: number;
      question: string;
      options: string[];
      correctAnswerIndex: number;
      explanation?: string;
    }>;

    // 4. Calculate score
    let score = 0;
    const totalQuestions = questions.length;
    const missedQuestions: string[] = [];

    questions.forEach((q, index) => {
      const userChoice = userAnswers[index];
      if (userChoice === q.correctAnswerIndex) {
        score++;
      } else {
        missedQuestions.push(
          `Question: "${q.question}"\nUser Answer: "${q.options[userChoice] ?? "None"}"\nCorrect Answer: "${q.options[q.correctAnswerIndex]}"\nExplanation: ${q.explanation || "N/A"}`
        );
      }
    });

    // 5. Generate AI feedback if any questions were missed
    let aiFeedback = "Perfect score! Outstanding work.";
    if (missedQuestions.length > 0) {
      try {
        const feedbackPrompt = `A student scored ${score}/${totalQuestions} on a quiz titled "${quiz.title}".
Here are the questions they missed:

${missedQuestions.join("\n\n")}

Provide brief, encouraging, and constructive study feedback (2-4 bullet points) explaining why the correct answers were right and what key concepts they should review.`;

        const feedbackResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: feedbackPrompt,
        });

        aiFeedback =
          feedbackResponse.text ||
          feedbackResponse.candidates?.[0]?.content?.parts?.[0]?.text ||
          "Review the questions you missed to reinforce your understanding.";
      } catch (err) {
        console.error("AI Feedback Generation Error:", err);
        aiFeedback = "Good effort! Review the document sections covering the missed questions.";
      }
    }

    // 6. Record attempt in database
    const attempt = await prisma.quizAttempt.create({
      data: {
        userId,
        quizId,
        score,
        totalQuestions,
        aiFeedback,
      },
    });

    return NextResponse.json({ attempt }, { status: 201 });
  } catch (error) {
    console.error("POST /api/quizzes/[id]/submit Error:", error);
    return NextResponse.json(
      { error: "Failed to submit quiz attempt" },
      { status: 500 }
    );
  }
}