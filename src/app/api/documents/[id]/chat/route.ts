import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const chatSchema = z.object({
  question: z.string().trim().min(1, "Question cannot be empty"),
});

interface JwtPayload {
  userId: string;
}

export async function POST(
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

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = chatSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { question } = validation.data;

    // 3. Fetch extracted text from database
    const document = await prisma.document.findFirst({
      where: {
        id,
        userId,
      },
      select: {
        extractedText: true,
        title: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // 4. Prompt Gemini using strict grounding instructions
    const prompt = `You are a strict, focused AI Study Assistant for the document titled "${document.title}".

Document Context:
${document.extractedText.slice(0, 10000)}

User Question: ${question}

Rules for Answering:
1. Primary Source: Base your response directly on the provided Document Context.
2. Conceptual Comparisons: If the user asks for comparison or clarification (e.g., comparing Redis mentioned in the text to In-Memory vs. Disk DBs, SQL vs. NoSQL), you MAY provide a brief explanation ONLY IF it directly clarifies the context in the document. Limit off-document comparative explanations to 2-3 sentences max.
3. Out-of-Bounds Refusal: If the question is completely unrelated to the topic/domain of the document (e.g., asking for general coding scripts, recipes, essay writing, or non-related subjects), politely decline by stating: "I can only answer questions related to the provided document (${document.title})."
4. Concise Tone: Keep the answer clear, helpful, and under 200 words.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    const answer =
      response.text ||
      response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn't process an answer right now.";

    return NextResponse.json({ answer }, { status: 200 });
  } catch (error) {
    console.error("POST /api/documents/[id]/chat Error:", error);
    return NextResponse.json(
      { error: "Failed to generate answer" },
      { status: 500 }
    );
  }
}