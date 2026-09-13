import { POST } from "@/app/api/documents/[id]/chat/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

// 1. Mock Gemini SDK
jest.mock("@google/genai", () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: "Redis is an in-memory key-value data store frequently used for caching.",
        }),
      },
    })),
  };
});

describe("API /api/documents/[id]/chat Integration Tests", () => {
  let testUserId: string;
  let otherUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // Seed primary user
    const user = await prisma.user.create({
      data: {
        username: "behramchat",
        email: "behramchat@gmail.com",
        passwordHash: "hashedpass123",
      },
    });

    testUserId = user.id;

    // Seed secondary user for isolation tests
    const otherUser = await prisma.user.create({
      data: {
        username: "otherchatuser",
        email: "otherchatuser@gmail.com",
        passwordHash: "hashedpass123",
      },
    });

    otherUserId = otherUser.id;

    // Sign JWT
    validToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );
  });

  // ==========================================
  // Auth & Validation Tests
  // ==========================================
  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/documents/doc-123/chat",
      {
        method: "POST",
        body: JSON.stringify({ question: "What is Redis?" }),
      }
    );

    const params = Promise.resolve({ id: "doc-123" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 400 if JSON body is malformed", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/documents/doc-123/chat",
      {
        method: "POST",
        body: "invalid-json-string",
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: "doc-123" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid JSON body");
  });

  it("should return 400 if question is empty or missing (Zod validation)", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/documents/doc-123/chat",
      {
        method: "POST",
        body: JSON.stringify({ question: "   " }),
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: "doc-123" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid request payload");
    expect(data.details).toBeDefined();
  });

  // ==========================================
  // Database & Ownership Tests
  // ==========================================
  it("should return 404 if document does not exist in database", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/documents/non-existent-id/chat",
      {
        method: "POST",
        body: JSON.stringify({ question: "Explain caching" }),
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: "non-existent-id" });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Document not found");
  });

  it("should return 404 if user tries to chat with another user's document", async () => {
    const otherDoc = await prisma.document.create({
      data: {
        userId: otherUserId,
        title: "Private Systems Doc",
        filePath: "/uploads/private_sys.pdf",
        extractedText: "Confidential caching strategies.",
        textHash: "hash_private_sys",
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/documents/${otherDoc.id}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ question: "What is inside this doc?" }),
      }
    );
    req.cookies.set("accessToken", validToken); // Auth as testUserId

    const params = Promise.resolve({ id: otherDoc.id });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Document not found");
  });

  // ==========================================
  // Success Flow Test
  // ==========================================
  it("should successfully process question against document context and return AI answer", async () => {
    const doc = await prisma.document.create({
      data: {
        userId: testUserId,
        title: "Redis Deep Dive",
        filePath: "/uploads/redis_guide.pdf",
        extractedText:
          "Redis is an in-memory data structure store used as a database, cache, streaming engine, and message broker.",
        textHash: "hash_redis_guide",
      },
    });

    const req = new NextRequest(
      `http://localhost:3000/api/documents/${doc.id}/chat`,
      {
        method: "POST",
        body: JSON.stringify({ question: "How does Redis work as a cache?" }),
      }
    );
    req.cookies.set("accessToken", validToken);

    const params = Promise.resolve({ id: doc.id });
    const res = await POST(req, { params });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.answer).toBe(
      "Redis is an in-memory key-value data store frequently used for caching."
    );
  });
});