import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// 1. Declare the mock function using the "mock" prefix rule
const mockGenerateContent = jest.fn();

// 2. Mock @google/genai using the scoped mock function
jest.mock("@google/genai", () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: (...args: any[]) => mockGenerateContent(...args),
      },
    })),
  };
});

// Import the route AFTER the mock declaration
import { POST } from "@/app/api/documents/[id]/chat/route";
import { prisma } from "@/lib/prisma";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: jest.fn(),
    },
  },
}));

describe("POST /api/documents/[id]/chat Unit Tests", () => {
  const mockParams = Promise.resolve({ id: "doc-123" });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 if access token cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/documents/doc-123/chat", {
      method: "POST",
      body: JSON.stringify({ question: "What is this document about?" }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 401 if JWT verification fails", async () => {
    jest.mocked(jwt.verify).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    const req = new NextRequest("http://localhost/api/documents/doc-123/chat", {
      method: "POST",
      headers: { cookie: "accessToken=invalid_token" },
      body: JSON.stringify({ question: "Explain caching" }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 400 if request payload fails Zod validation", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const req = new NextRequest("http://localhost/api/documents/doc-123/chat", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ question: "   " }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Invalid request payload");
    expect(data).toHaveProperty("details");
  });

  it("should return 404 if document is not found", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/documents/doc-123/chat", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ question: "Explain indexing" }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Document not found");
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-123", userId: "user-101" },
      select: { extractedText: true, title: true },
    });
  });

  it("should return 200 with generated answer from Gemini", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockDoc = {
      title: "OS Operating System Notes",
      extractedText: "Process scheduling controls CPU allocation across tasks...",
    };
    jest.mocked(prisma.document.findFirst).mockResolvedValue(mockDoc as never);

    mockGenerateContent.mockResolvedValueOnce({
      text: "Process scheduling allocates CPU execution time efficiently.",
    });

    const req = new NextRequest("http://localhost/api/documents/doc-123/chat", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ question: "What is process scheduling?" }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.answer).toBe(
      "Process scheduling allocates CPU execution time efficiently."
    );
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-3.6-flash",
      })
    );
  });

  it("should return 500 if Gemini generation fails", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockDoc = { title: "Doc", extractedText: "Content..." };
    jest.mocked(prisma.document.findFirst).mockResolvedValue(mockDoc as never);

    mockGenerateContent.mockRejectedValueOnce(new Error("Gemini API Error"));

    const req = new NextRequest("http://localhost/api/documents/doc-123/chat", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ question: "What is this?" }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to generate answer");
  });
});