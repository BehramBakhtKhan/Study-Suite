import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "@/app/api/documents/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import pdf from "pdf-parse/lib/pdf-parse.js";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";

// 1. Mock External Dependencies
jest.mock("jsonwebtoken");
jest.mock("pdf-parse/lib/pdf-parse.js");
jest.mock("@google/genai");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe("API /api/documents Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // GET /api/documents
  describe("GET /api/documents", () => {
    it("should return 401 if not token is provided", async () => {
      const req = new NextRequest("http://localhost/api/documents", {
        method: "GET",
        headers: { getSetCookie: "" },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
      expect(data).toHaveProperty("error");
    });

    it("should return 200 with documents when authorized", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

      const mockDocs = [
        {
          id: "doc-1",
          title: "OS Operating System Notes",
          filePath: "/uploads/os.pdf",
          summary: "Detailed overview of process scheduling...",
          createdAt: new Date(),
        },
      ];
      jest.mocked(prisma.document.findMany).mockResolvedValue(mockDocs as never);

      const req = new NextRequest("http://localhost/api/documents", {
        method: "GET",
        headers: {
          cookie: "accessToken=valid_token",
        },
      });
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.documents).toHaveLength(1);
      expect(data.documents[0].title).toBe("OS Operating System Notes");
      expect(prisma.document.findMany).toHaveBeenCalledWith({
        where: { userId: "user-101" },
        select: {
          id: true,
          title: true,
          filePath: true,
          summary: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return 500 if database fetch fails", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
      jest
        .mocked(prisma.document.findMany)
        .mockRejectedValue(new Error("DB Connection Error"));

      const req = new NextRequest("http://localhost/api/documents", {
        method: "GET",
        headers: {
          cookie: "accessToken=valid_token",
        },
      });

      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to retrieve documents");
    });
  });

  // POST /api/documents
  describe("POST /api/documents", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv, GEMINI_API_KEY: "test_gemini_key" };
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    // 1. Missing Token
    it("should return 401 if access token is missing", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new File(["pdf content"], "doc.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    // 2. Missing File in FormData
    it("should return 400 if no file field is present", async () => {
      const formData = new FormData();

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("A PDF file is required");
    });

    // 3. Non-PDF File Type
    it("should return 400 if file is not a PDF", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new File(["text"], "notes.txt", { type: "text/plain" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Only PDF files with extension .pdf are supported");
    });

    // 4. File Size Exceeds 5MB
    it("should return 400 if file size exceeds 5MB limit", async () => {
      const largeBuffer = new Uint8Array(5 * 1024 * 1024 + 1); // > 5MB
      const formData = new FormData();
      formData.append(
        "file",
        new File([largeBuffer], "large.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("File size exceeds the maximum limit of 5MB");
    });

    // 5. PDF Parsing Throws Error
    it("should return 422 if pdf-parse fails", async () => {
      jest.mocked(pdf).mockRejectedValue(new Error("Corrupted PDF"));

      const formData = new FormData();
      formData.append(
        "file",
        new File(["corrupted content"], "test.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.error).toBe("Failed to parse text from the PDF file");
    });

    // 6. PDF Contains Empty Text
    it("should return 422 if PDF yields empty text", async () => {
      jest.mocked(pdf).mockResolvedValue({ text: "   " } as never);

      const formData = new FormData();
      formData.append(
        "file",
        new File(["blank pdf"], "blank.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.error).toBe("The PDF contains no readable text content");
    });

    // 7. Duplicate Document Detection
    it("should return 200 and existing document if duplicate detected", async () => {
      const pdfText = "Operating System Concepts and Threads";
      jest.mocked(pdf).mockResolvedValue({ text: pdfText } as never);

      const existingDoc = {
        id: "existing-doc-id",
        title: "os_notes",
        textHash: "some_calculated_hash",
        extractedText: pdfText,
      };
      jest.mocked(prisma.document.findFirst).mockResolvedValue(existingDoc as never);

      const formData = new FormData();
      formData.append(
        "file",
        new File([pdfText], "os_notes.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe(
        "Duplicate document detected. Retrieved existing version."
      );
      expect(data.document).toBeDefined();
    });

    // 8. Successful Upload with Gemini Summary
    it("should return 201 and save new document with generated summary", async () => {
      const pdfText = "Full course content about database systems";
      jest.mocked(pdf).mockResolvedValue({ text: pdfText } as never);
      jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

      jest.spyOn(fs, "mkdir").mockResolvedValue(undefined as never);
      jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never);

      const mockGenerateContent = jest.fn().mockResolvedValue({
        text: "- Overview: Essential database management systems notes.",
      });
      jest.mocked(GoogleGenAI).mockImplementation(
        () => ({ models: { generateContent: mockGenerateContent } } as never)
      );

      const createdDoc = {
        id: "new-doc-123",
        userId: "user-101",
        title: "db_notes",
        filePath: "/uploads/uuid-db_notes.pdf",
        extractedText: pdfText,
        summary: "- Overview: Essential database management systems notes.",
      };
      jest.mocked(prisma.document.create).mockResolvedValue(createdDoc as never);

      const formData = new FormData();
      formData.append(
        "file",
        new File([pdfText], "db_notes.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.document.summary).toBe(
        "- Overview: Essential database management systems notes."
      );
      expect(fs.writeFile).toHaveBeenCalled();
      expect(prisma.document.create).toHaveBeenCalled();
    });

    // 9. Fallback when GEMINI_API_KEY is missing
    it("should save document with missing API key fallback message when key is absent", async () => {
      delete process.env.GEMINI_API_KEY;

      const pdfText = "Network protocols summary";
      jest.mocked(pdf).mockResolvedValue({ text: pdfText } as never);
      jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

      jest.spyOn(fs, "mkdir").mockResolvedValue(undefined as never);
      jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never);

      jest.mocked(prisma.document.create).mockImplementation(
        ({ data }: any) => Promise.resolve({ id: "doc-99", ...data }) as never
      );

      const formData = new FormData();
      formData.append(
        "file",
        new File([pdfText], "networks.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.document.summary).toBe("API key missing on server.");
    });

    // 10. Fallback when Gemini API fails
    it("should handle Gemini execution error gracefully", async () => {
      const pdfText = "Algorithmic thinking and complexity analysis";
      jest.mocked(pdf).mockResolvedValue({ text: pdfText } as never);
      jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

      jest.spyOn(fs, "mkdir").mockResolvedValue(undefined as never);
      jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as never);

      const mockGenerateContent = jest
        .fn()
        .mockRejectedValue(new Error("API Quota Exceeded"));
      jest.mocked(GoogleGenAI).mockImplementation(
        () => ({ models: { generateContent: mockGenerateContent } } as never)
      );

      jest.mocked(prisma.document.create).mockImplementation(
        ({ data }: any) => Promise.resolve({ id: "doc-100", ...data }) as never
      );

      const formData = new FormData();
      formData.append(
        "file",
        new File([pdfText], "algo.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.document.summary).toBe(
        "Summary generation unavailable at this moment."
      );
    });

    // 11. Unhandled Server Error (500)
    it("should return 500 if file system operation throws an exception", async () => {
      const pdfText = "System architecture notes";
      jest.mocked(pdf).mockResolvedValue({ text: pdfText } as never);
      jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

      jest.spyOn(fs, "mkdir").mockRejectedValue(new Error("Permission denied"));

      const formData = new FormData();
      formData.append(
        "file",
        new File([pdfText], "arch.pdf", { type: "application/pdf" })
      );

      const req = new NextRequest("http://localhost/api/documents", {
        method: "POST",
        headers: { cookie: "accessToken=valid_token" },
        body: formData,
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Permission denied");
    });
  });

  // DELETE /api/documents
  describe("DELETE /api/documents", () => {
    // 1. Missing Token
    it("should return 401 if access token is missing", async () => {
      const req = new NextRequest("http://localhost/api/documents", {
        method: "DELETE",
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    // 2. Successful Bulk Deletion
    it("should return 200 and delete files from disk and database records", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

      const mockDocs = [
        { filePath: "/uploads/file1.pdf" },
        { filePath: "/uploads/file2.pdf" },
      ];
      jest.mocked(prisma.document.findMany).mockResolvedValue(mockDocs as never);
      jest.spyOn(fs, "unlink").mockResolvedValue(undefined as never);
      jest.mocked(prisma.document.deleteMany).mockResolvedValue({ count: 2 } as never);

      const req = new NextRequest("http://localhost/api/documents", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("All documents deleted successfully");
      expect(data.count).toBe(2);
      expect(fs.unlink).toHaveBeenCalledTimes(2);
      expect(prisma.document.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-101" },
      });
    });

    // 3. Graceful handling of missing files during disk cleanup
    it("should proceed with deletion even if fs.unlink fails", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

      const mockDocs = [{ filePath: "/uploads/missing.pdf" }];
      jest.mocked(prisma.document.findMany).mockResolvedValue(mockDocs as never);
      jest.spyOn(fs, "unlink").mockRejectedValue(new Error("ENOENT: file not found"));
      jest.mocked(prisma.document.deleteMany).mockResolvedValue({ count: 1 } as never);

      const req = new NextRequest("http://localhost/api/documents", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.count).toBe(1);
      expect(prisma.document.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-101" },
      });
    });

    // 4. Database Failure
    it("should return 500 if database deletion fails", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
      jest.mocked(prisma.document.findMany).mockRejectedValue(new Error("DB Connection Error"));

      const req = new NextRequest("http://localhost/api/documents", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to delete documents");
    });
  });
});