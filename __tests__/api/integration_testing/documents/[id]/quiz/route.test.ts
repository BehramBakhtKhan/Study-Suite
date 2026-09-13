import { POST } from "@/app/api/documents/[id]/quiz/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

// Mock Gemini SDK and Type export
jest.mock("@google/genai", () => {
  return {
    Type: {
      OBJECT: "OBJECT",
      ARRAY: "ARRAY",
      STRING: "STRING",
      INTEGER: "INTEGER",
    },
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            questions: [
              {
                id: 1,
                question: "What is Redis?",
                options: [
                  "In-Memory Data Structure Store",
                  "Relational Database",
                  "CSS Framework",
                  "Operating System",
                ],
                correctAnswerIndex: 0,
                explanation:
                  "Redis is an in-memory key-value data store used for caching.",
              },
            ],
          }),
        }),
      },
    })),
  };
});

describe("API /api/documents/[id]/quiz Integration Tests", () => {
  let testUserId: string;
  let otherUserId: string;
  let validToken: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      GEMINI_API_KEY: "mock-gemini-api-key",
    };

    // Seed primary user
    const user = await prisma.user.create({
      data: {
        username: "behramquiz",
        email: "behramquiz@gmail.com",
        passwordHash: "hashedpass123",
      },
    });
    testUserId = user.id;

    // Seed secondary user
    const otherUser = await prisma.user.create({
      data: {
        username: "otherquizuser",
        email: "otherquizuser@gmail.com",
        passwordHash: "hashedpass123",
      },
    });
    otherUserId = otherUser.id;

    validToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ==========================================
  // Auth & Environment Error Tests
  // ==========================================
  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/documents/doc-123/quiz",
      { method: "POST" }
    );

    const context = { params: Promise.resolve({ id: "doc-123" }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 500 if GEMINI_API_KEY is missing from environment", async () => {
    delete process.env.GEMINI_API_KEY;

    const doc = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "OS Architecture",
        filePath: "/uploads/os.pdf",
        extractedText: "Kernel and System Calls",
        textHash: "os_hash_key_test",
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/documents/${doc.id}/quiz`,
      { method: "POST" }
    );
    req.cookies.set("accessToken", validToken);

    const context = { params: Promise.resolve({ id: doc.id }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe(
      "GEMINI_API_KEY is missing from environment variables"
    );
  });

  // ==========================================
  // Document Validation Tests
  // ==========================================
  it("should return 404 if document does not exist in database", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/documents/non-existent-id/quiz",
      { method: "POST" }
    );
    req.cookies.set("accessToken", validToken);

    const context = { params: Promise.resolve({ id: "non-existent-id" }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Document not found");
  });

  it("should return 404 if attempting to create a quiz for another user's document", async () => {
    const otherDoc = await prisma.document.create({
      data: {
        userId: otherUserId,
        title: "Unauthorized Doc",
        filePath: "/uploads/unauthorized.pdf",
        extractedText: "Secret text content.",
        textHash: "unauth_hash",
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/documents/${otherDoc.id}/quiz`,
      { method: "POST" }
    );
    req.cookies.set("accessToken", validToken);

    const context = { params: Promise.resolve({ id: otherDoc.id }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Document not found");
  });

  it("should return 422 if document extractedText is empty", async () => {
    const emptyDoc = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "Empty PDF",
        filePath: "/uploads/empty.pdf",
        extractedText: "",
        textHash: "empty_text_hash",
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/documents/${emptyDoc.id}/quiz`,
      { method: "POST" }
    );
    req.cookies.set("accessToken", validToken);

    const context = { params: Promise.resolve({ id: emptyDoc.id }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toBe("Document text is empty or unreadable");
  });

  // ==========================================
  // Success & Persistence Flow
  // ==========================================
  it("should successfully generate quiz and persist it to PostgreSQL with incremented title", async () => {
    const doc = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "PostgreSQL Indexing",
        filePath: "/uploads/postgres_indexes.pdf",
        extractedText:
          "B-Tree indexes speed up equality and range queries on databases.",
        textHash: "pg_index_hash",
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/documents/${doc.id}/quiz`,
      {
        method: "POST",
        body: JSON.stringify({ numQuestions: 5 }),
      }
    );
    req.cookies.set("accessToken", validToken);

    const context = { params: Promise.resolve({ id: doc.id }) };
    const res = await POST(req, context);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.quiz).toBeDefined();
    expect(data.quiz.title).toBe("PostgreSQL Indexing - Quiz #1");
    expect(data.quiz.questions.length).toBe(1);

    // Verify database record creation
    const dbQuiz = await prisma.quiz.findUnique({
      where: { id: data.quiz.id },
    });
    expect(dbQuiz).not.toBeNull();
    expect(dbQuiz?.documentId).toBe(doc.id);
  });
});