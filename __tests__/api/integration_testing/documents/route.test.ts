import { GET, POST, DELETE } from "@/app/api/documents/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// Mock pdf-parse and Gemini SDK
jest.mock("pdf-parse/lib/pdf-parse.js", () => {
  return jest.fn().mockResolvedValue({
    text: "Sample extracted PDF content for integration testing.",
  });
});

jest.mock("@google/genai", () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      models: {
        generateContent: jest.fn().mockResolvedValue({
          text: "Detailed AI generated summary content.",
        }),
      },
    })),
  };
});

describe("API /api/documents Integration Tests", () => {
  let testUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // Spy on fs operations to prevent touching physical disk
    jest.spyOn(fs, "mkdir").mockResolvedValue(undefined as any);
    jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as any);
    jest.spyOn(fs, "unlink").mockResolvedValue(undefined as any);

    // Seed test user in PostgreSQL
    const user = await prisma.user.create({
      data: {
        username: "behramdoc",
        email: "behramdoc@gmail.com",
        passwordHash: "hashedpass123",
      },
    });

    testUserId = user.id;

    validToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // GET /api/documents Integration Tests
  // ==========================================
  describe("GET /api/documents", () => {
    it("should return 401 if access token cookie is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "GET",
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should fetch all user documents ordered by creation date descending", async () => {
      await prisma.document.createMany({
        data: [
          {
            userId: testUserId,
            title: "First Document",
            filePath: "/uploads/doc1.pdf",
            extractedText: "Text 1",
            textHash: "hash1",
            createdAt: new Date("2026-01-01"),
          },
          {
            userId: testUserId,
            title: "Second Document",
            filePath: "/uploads/doc2.pdf",
            extractedText: "Text 2",
            textHash: "hash2",
            createdAt: new Date("2026-01-02"),
          },
        ],
      });

      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "GET",
      });
      req.cookies.set("accessToken", validToken);

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.documents.length).toBe(2);
      expect(data.documents[0].title).toBe("Second Document");
    });
  });

  // ==========================================
  // POST /api/documents Integration Tests
  // ==========================================
  describe("POST /api/documents", () => {
    it("should return 400 if no file is provided in FormData", async () => {
      const formData = new FormData();

      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: formData,
      });
      req.cookies.set("accessToken", validToken);

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("A PDF file is required");
    });

    it("should return 400 if attached file is not a PDF", async () => {
      const formData = new FormData();
      const txtFile = new File(["dummy text content"], "notes.txt", {
        type: "text/plain",
      });
      formData.append("file", txtFile);

      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: formData,
      });
      req.cookies.set("accessToken", validToken);

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe(
        "Only PDF files with extension .pdf are supported"
      );
    });

    it("should process valid PDF upload, generate AI summary, and persist to DB", async () => {
      const formData = new FormData();
      const pdfBlob = new Blob(["%PDF-1.4 test document content"], {
        type: "application/pdf",
      });
      const pdfFile = new File([pdfBlob], "operating_systems.pdf", {
        type: "application/pdf",
      });
      formData.append("file", pdfFile);

      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: formData,
      });
      req.cookies.set("accessToken", validToken);

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.document).toBeDefined();
      expect(data.document.title).toBe("operating_systems");
      expect(data.document.summary).toBe(
        "Detailed AI generated summary content."
      );

      const dbDoc = await prisma.document.findUnique({
        where: { id: data.document.id },
      });
      expect(dbDoc).not.toBeNull();
      expect(dbDoc?.userId).toBe(testUserId);
    });

    it("should return existing document if duplicate content is uploaded", async () => {
      const pdfBlob = new Blob(["%PDF-1.4 test document content"], {
        type: "application/pdf",
      });
      const pdfFile = new File([pdfBlob], "operating_systems.pdf", {
        type: "application/pdf",
      });

      const formData1 = new FormData();
      formData1.append("file", pdfFile);
      const req1 = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: formData1,
      });
      req1.cookies.set("accessToken", validToken);
      await POST(req1);

      const formData2 = new FormData();
      formData2.append("file", pdfFile);
      const req2 = new NextRequest("http://localhost:3000/api/documents", {
        method: "POST",
        body: formData2,
      });
      req2.cookies.set("accessToken", validToken);

      const res = await POST(req2);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe(
        "Duplicate document detected. Retrieved existing version."
      );
    });
  });

  // ==========================================
  // DELETE /api/documents Integration Tests
  // ==========================================
  describe("DELETE /api/documents", () => {
    it("should delete all documents for authenticated user and unlink local files", async () => {
      const relativeFilePath = "/uploads/delete_me.pdf";

      await prisma.document.create({
        data: {
          userId: testUserId,
          title: "Delete Me",
          filePath: relativeFilePath,
          extractedText: "To be removed",
          textHash: "hash_to_delete",
        },
      });

      const req = new NextRequest("http://localhost:3000/api/documents", {
        method: "DELETE",
      });
      req.cookies.set("accessToken", validToken);

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.count).toBe(1);

      const userDocs = await prisma.document.findMany({
        where: { userId: testUserId },
      });
      expect(userDocs.length).toBe(0);

      const expectedPath = path.join(process.cwd(), "public", relativeFilePath);
      expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
    });
  });
});