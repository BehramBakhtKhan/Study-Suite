import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import path from "path";
// Directly import the core file to bypass pdf-parse's self-test execution
import pdf from "pdf-parse/lib/pdf-parse.js";
import { createHash, randomUUID } from "crypto";

interface JwtPayload {
  userId: string;
}

// Helper to authenticate user via cookie
function getUserIdFromCookie(req: NextRequest): string | null {
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

// GET /api/documents - Retrieve all user documents ordered by creation date
export async function GET(req: NextRequest) {
  try {
    const userId = getUserIdFromCookie(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    const documents = await prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        filePath: true,
        summary: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ documents }, { status: 200 });
  } catch (error) {
    console.error("GET /api/documents Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve documents" },
      { status: 500 }
    );
  }
}

// POST /api/documents - Upload PDF, validate size/type, extract text, and generate summary
export async function POST(req: NextRequest) {
  try {
    const userId = getUserIdFromCookie(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A PDF file is required" },
        { status: 400 }
      );
    }

    // 1. Validation: File extension & size limit (5MB)
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json(
        { error: "Only PDF files with extension .pdf are supported" },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the maximum limit of 5MB" },
        { status: 400 }
      );
    }

    // 2. Extract raw text from PDF buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let rawText = "";

    try {
      const parsedPdf = await pdf(buffer);
      rawText = parsedPdf.text ? parsedPdf.text.trim() : "";
    } catch (parseErr) {
      console.error("PDF Parsing Error:", parseErr);
      return NextResponse.json(
        { error: "Failed to parse text from the PDF file" },
        { status: 422 }
      );
    }

    if (!rawText) {
      return NextResponse.json(
        { error: "The PDF contains no readable text content" },
        { status: 422 }
      );
    }

    // Strip PostgreSQL-incompatible null bytes (\u0000) from extracted text
    const extractedText = rawText.replace(/\0/g, "");

    // 3. Generate Normalized Text Hash (Ignores spaces, punctuation, case & file title)
    const normalizedText = extractedText
      .toLowerCase()
      .replace(/[\s\W_]+/g, ""); // Strips all whitespace and non-alphanumeric chars

    const textHash = createHash("sha256").update(normalizedText).digest("hex");
    const incomingCharCount = extractedText.length;

    // 4. Duplicate Check: Exact hash match OR title match with close character length
    const existingDoc = await prisma.document.findFirst({
      where: {
        userId,
        OR: [
          { textHash }, // Catches identical files even if renamed
          { title: file.name.replace(/\.pdf$/i, "") }, // Catches matching titles
        ],
      },
    });

    if (existingDoc) {
      console.log("Duplicate Document Detected...");
      const existingCharCount = existingDoc.extractedText.length;
      const lengthDifference =
        Math.abs(existingCharCount - incomingCharCount) / existingCharCount;

      // If text hash matches OR character count is within 5% range (prevents partial upload false positives)
      if (existingDoc.textHash === textHash || lengthDifference < 0.05) {
        return NextResponse.json(
          {
            document: existingDoc,
            message:
              "Duplicate document detected. Retrieved existing version.",
          },
          { status: 200 }
        );
      }
    }

    // 5. Save unique file to public/uploads directory
    const uuid = randomUUID();
    const sanitizedOriginalName = file.name.replace(/\s+/g, "_");
    const storedFilename = `${uuid}-${sanitizedOriginalName}`;

    const uploadDirectory = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(path.join(uploadDirectory, storedFilename), buffer);

    // 6. Clean text & generate summary via Gemini SDK
    let summary: string | null = null;
    const apiKey = process.env.GEMINI_API_KEY;

    const cleanedText = extractedText
      .replace(/\r\n|\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    const contentSample =
      cleanedText.length > 10000
        ? cleanedText.slice(0, 10000)
        : cleanedText;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: `You are an expert study assistant. Summarize the following document excerpt for a student in detail.
        
        Guidelines:
        1. Maximum Length: Under 450 words total. Provide a detailed, comprehensive summary.
        2. Language: Use simple, plain English without unnecessary jargon.
        3. Formatting: 1-2 sentence high-level overview followed by plain dash bullets (- ). Do NOT use bolding, asterisks (* or **), markdown headers (#), or extra markup.
        4. Section Context & Main Points: Preserve chapter numbers or main topic headings at the start of each bullet point (e.g., "- Chapter 1 (Basic Values): ..."). Explain the core ideas, actionable takeaways, and underlying reasoning for each section rather than just giving a high-level title statement.
        5. Depth: Cover key sub-points, core arguments, and critical takeaways thoroughly so the student gets actionable insights.
        
        Document Text:
        ${contentSample}`,
        });

        const rawSummary = response.text?.trim() || null;
        summary = rawSummary ? rawSummary.replace(/\0/g, "") : null;
      } catch (aiErr: any) {
        console.error("Gemini API Exec Error Details:", aiErr?.message);
        summary = "Summary generation unavailable at this moment.";
      }
    } else {
      summary = "API key missing on server.";
    }

    // 7. Persist new unique document with textHash
    const document = await prisma.document.create({
      data: {
        userId,
        title: file.name.replace(/\.pdf$/i, ""),
        filePath: `/uploads/${storedFilename}`,
        extractedText,
        summary,
        textHash,
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/documents Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error during processing" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents - Bulk delete all documents for the authenticated user
export async function DELETE(req: NextRequest) {
  try {
    const userId = getUserIdFromCookie(req);
    if (!userId) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    // 1. Fetch file paths to clean up local storage
    const userDocs = await prisma.document.findMany({
      where: { userId },
      select: { filePath: true },
    });

    // 2. Delete actual files from disk
    for (const doc of userDocs) {
      if (doc.filePath) {
        const fullPath = path.join(process.cwd(), "public", doc.filePath);
        try {
          await fs.unlink(fullPath);
        } catch (fileErr) {
          console.warn(`Could not remove file at ${fullPath}:`, fileErr);
        }
      }
    }

    // 3. Delete records from database
    const result = await prisma.document.deleteMany({
      where: { userId },
    });

    return NextResponse.json(
      {
        message: "All documents deleted successfully",
        count: result.count,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("DELETE /api/documents Error:", error);
    return NextResponse.json(
      { error: "Failed to delete documents" },
      { status: 500 }
    );
  }
}