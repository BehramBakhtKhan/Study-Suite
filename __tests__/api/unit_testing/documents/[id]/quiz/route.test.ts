import { NextRequest } from "next/server";
import jwt from "jsonwebtoken";

// 1. Declare persistent mock function
const mockGenerateContent = jest.fn();

// 2. Mock @google/genai module
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
        generateContent: (...args: any[]) => mockGenerateContent(...args),
      },
    })),
  };
});

// Import route AFTER mocking
import { POST } from "@/app/api/documents/[id]/quiz/route";
import { prisma } from "@/lib/prisma";

jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: jest.fn(),
    },
    quiz: {
      create: jest.fn(),
    },
  },
}));

describe("POST /api/documents/[id]/quiz Unit Tests", () => {
  const mockParams = Promise.resolve({ id: "doc-123" });
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: "test_key" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // 1. Auth Failures
  it("should return 401 if accessToken cookie is missing", async () => {
    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
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

    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
      headers: { cookie: "accessToken=invalid_token" },
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  // 2. Resource Validation
  it("should return 404 if document is not found", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Document not found");
  });

  it("should return 422 if document extractedText is missing or empty", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.document.findFirst).mockResolvedValue({
      title: "Empty Document",
      extractedText: "",
      quizzes: [],
    } as never);

    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(422);
    expect(data.error).toBe("Document text is empty or unreadable");
  });

  // 3. Environment Variable Check
  it("should return 500 if GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;

    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.document.findFirst).mockResolvedValue({
      title: "Doc Title",
      extractedText: "Some text content...",
      quizzes: [],
    } as never);

    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe(
      "GEMINI_API_KEY is missing from environment variables"
    );
  });

  // 4. AI Response Parsing Failures
  it("should return 502 if Gemini returns empty response", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.document.findFirst).mockResolvedValue({
      title: "Doc Title",
      extractedText: "Valid extracted text content.",
      quizzes: [],
    } as never);

    mockGenerateContent.mockResolvedValueOnce({ text: "" });

    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toBe("Empty output returned from Gemini");
  });

  it("should return 502 if Gemini output is invalid JSON", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.document.findFirst).mockResolvedValue({
      title: "Doc Title",
      extractedText: "Valid extracted text content.",
      quizzes: [],
    } as never);

    mockGenerateContent.mockResolvedValueOnce({
      text: "NOT_VALID_JSON",
    });

    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toBe("AI response failed to parse as valid JSON");
  });

  // 5. Successful Execution
  it("should generate quiz successfully, preventing duplicate questions and saving to database", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    // Mock existing quizzes to test duplicate exclusion prompt building
    const mockDocument = {
      title: "Operating Systems",
      extractedText: "Process scheduling algorithms allocate CPU time...",
      quizzes: [
        {
          questions: [{ question: "What is FIFO?" }],
        },
      ],
    };
    jest
      .mocked(prisma.document.findFirst)
      .mockResolvedValue(mockDocument as never);

    const mockGeneratedQuestions = [
      {
        id: 1,
        question: "What is Round Robin scheduling?",
        options: ["Preemptive", "Non-preemptive", "Batch", "Manual"],
        correctAnswerIndex: 0,
        explanation: "Round Robin uses time slices.",
      },
    ];

    mockGenerateContent.mockResolvedValueOnce({
      text: JSON.stringify({ questions: mockGeneratedQuestions }),
    });

    const mockCreatedQuiz = {
      id: "quiz-888",
      documentId: "doc-123",
      title: "Operating Systems - Quiz #2",
      questions: mockGeneratedQuestions,
    };
    jest.mocked(prisma.quiz.create).mockResolvedValue(mockCreatedQuiz as never);

    const req = new NextRequest("http://localhost/api/documents/doc-123/quiz", {
      method: "POST",
      headers: { cookie: "accessToken=valid_token" },
      body: JSON.stringify({ numQuestions: 3 }),
    });

    const res = await POST(req, { params: mockParams });
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.quiz.id).toBe("quiz-888");

    // Verify duplicate question rule was injected in the prompt
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.stringContaining("DO NOT repeat or rephrase"),
      })
    );

    // Verify DB creation payload
    expect(prisma.quiz.create).toHaveBeenCalledWith({
      data: {
        documentId: "doc-123",
        title: "Operating Systems - Quiz #2",
        questions: mockGeneratedQuestions,
      },
    });
  });
});