import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";

const generateQuizSchema = z.object({
  numQuestions: z.number().int().min(1).max(20).default(5),
});

interface JwtPayload {
  userId: string;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Next.js 15 fix: await params
    const { id } = await context.params;

    // 2. Extract accessToken from HTTP-only cookie
    const token = req.cookies.get("accessToken")?.value;
    if (!token) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    // 3. Verify JWT token
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

    let numQuestions = 5;
    try {
      const body = await req.json();
      const validation = generateQuizSchema.safeParse(body);
      if (validation.success) {
        numQuestions = validation.data.numQuestions;
      }
    } catch {
      // Default fallback if body is empty
    }

    // 4. Fetch document and existing quizzes
    const document = await prisma.document.findFirst({
      where: { id, userId },
      select: {
        title: true,
        extractedText: true,
        quizzes: {
          select: { questions: true },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (!document.extractedText) {
      return NextResponse.json(
        { error: "Document text is empty or unreadable" },
        { status: 422 }
      );
    }

    // 5. Gather previous questions to prevent duplicates
    const previousQuestionsList: string[] = [];
    document.quizzes.forEach((q) => {
      const questionsArr = q.questions as Array<{ question: string }>;
      if (Array.isArray(questionsArr)) {
        questionsArr.forEach((item) => {
          if (item?.question) previousQuestionsList.push(item.question);
        });
      }
    });

    let exclusionInstruction = "";
    if (previousQuestionsList.length > 0) {
      exclusionInstruction =
        `\n\nCRITICAL RULE: DO NOT repeat or rephrase any of the following questions:\n` +
        previousQuestionsList.map((q, idx) => `${idx + 1}. ${q}`).join("\n") +
        `\n\nFocus on unexamined topics, deeper details, or alternative scenarios.`;
    }

    // 6. Instantiate Gemini Client
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing from environment variables" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Generate a ${numQuestions}-question multiple-choice quiz based on the following text.
Document Title: ${document.title}
${exclusionInstruction}

Text Content:
${document.extractedText.slice(0, 10000)}`;

    // 7. Execute call using gemini-3.6-flash & Type Enum schema
    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctAnswerIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: [
                  "id",
                  "question",
                  "options",
                  "correctAnswerIndex",
                  "explanation",
                ],
              },
            },
          },
          required: ["questions"],
        },
      },
    });

    const rawText = response.text?.trim() || "";
    if (!rawText) {
      return NextResponse.json(
        { error: "Empty output returned from Gemini" },
        { status: 502 }
      );
    }

    // 8. Direct JSON Parsing (Gemini guarantees raw valid JSON with responseMimeType)
    let quizData: { questions: any[] };
    try {
      quizData = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON Output:", rawText);
      return NextResponse.json(
        { error: "AI response failed to parse as valid JSON" },
        { status: 502 }
      );
    }

    if (!quizData?.questions || !Array.isArray(quizData.questions)) {
      return NextResponse.json(
        { error: "Quiz data payload structured incorrectly" },
        { status: 422 }
      );
    }

    // 9. Save quiz in Prisma
    const quiz = await prisma.quiz.create({
      data: {
        documentId: id,
        title: `${document.title} - Quiz #${document.quizzes.length + 1}`,
        questions: quizData.questions,
      },
    });

    return NextResponse.json({ quiz }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/documents/[id]/quiz Fatal Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate quiz" },
      { status: 500 }
    );
  }
}