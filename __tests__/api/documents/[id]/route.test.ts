import { NextRequest, NextResponse } from "next/server";
import { GET, DELETE } from "@/app/api/documents/[id]/route"
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

// Mock dependencies
jest.mock("jsonwebtoken");

jest.mock("@/lib/prisma", () => ({
  prisma: {
    document: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));


describe("GET /api/document/[id]", () => {

  it("should return 401 if token is missing", async () => {
    const req = new NextRequest("http://localhost/api/documents/doc-123", {
      method: "GET",
      headers: { getSetCookie: "" }
    });
    const res = await GET(req, { params: Promise.resolve({ id: "doc-123 "})});
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe("Access token missing or invalid");
  });

  it("should return 404 if document is not found", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/documents/doc-999", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req, {
      params: Promise.resolve({ id: "doc-999" }),
    });
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe("Document not found");
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-999", userId: "user-101" },
    });
  });

  it("should return 200 with document details when found", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

    const mockDoc = {
      id: "doc-123",
      userId: "user-101",
      title: "OS Operating System Notes",
      filePath: "/uploads/os.pdf",
      summary: "Summary text",
    };
    jest.mocked(prisma.document.findFirst).mockResolvedValue(mockDoc as never);

    const req = new NextRequest("http://localhost/api/documents/doc-123", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req, {
      params: Promise.resolve({ id: "doc-123" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.document.id).toBe("doc-123");
  });

  it("should return 500 if database query fails", async () => {
    jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
    jest
      .mocked(prisma.document.findFirst)
      .mockRejectedValue(new Error("Database failure"));

    const req = new NextRequest("http://localhost/api/documents/doc-123", {
      method: "GET",
      headers: { cookie: "accessToken=valid_token" },
    });

    const res = await GET(req, {
      params: Promise.resolve({ id: "doc-123" }),
    });
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBe("Failed to fetch document");
  });

  // DELETE /api/documents/[id]
  describe("DELETE /api/documents/[id]", () => {
    
    it("should return 401 if access token is missing", async () => {
      const req = new NextRequest("http://localhost/api/documents/doc-123", {
        method: "DELETE",
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: "doc-123" }),
      });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should return 404 if document does not exist", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
      jest.mocked(prisma.document.findFirst).mockResolvedValue(null);

      const req = new NextRequest("http://localhost/api/documents/doc-999", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: "doc-999" }),
      });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Document not found");
    });

    it("should return 200, delete file from disk and delete database record", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

      const mockDoc = { filePath: "/uploads/file.pdf" };
      jest.mocked(prisma.document.findFirst).mockResolvedValue(mockDoc as never);
      jest.spyOn(fs, "unlink").mockResolvedValue(undefined as never);
      jest.mocked(prisma.document.delete).mockResolvedValue({ id: "doc-123" } as never);

      const req = new NextRequest("http://localhost/api/documents/doc-123", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: "doc-123" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("Document deleted successfully");
      expect(fs.unlink).toHaveBeenCalled();
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: "doc-123" },
      });
    });

    it("should proceed with deletion even if fs.unlink fails", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);

      const mockDoc = { filePath: "/uploads/missing.pdf" };
      jest.mocked(prisma.document.findFirst).mockResolvedValue(mockDoc as never);
      jest.spyOn(fs, "unlink").mockRejectedValue(new Error("File not found"));
      jest.mocked(prisma.document.delete).mockResolvedValue({ id: "doc-123" } as never);

      const req = new NextRequest("http://localhost/api/documents/doc-123", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: "doc-123" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(prisma.document.delete).toHaveBeenCalledWith({
        where: { id: "doc-123" },
      });
    });

    it("should return 500 if database deletion fails", async () => {
      jest.mocked(jwt.verify).mockReturnValue({ userId: "user-101" } as never);
      jest
        .mocked(prisma.document.findFirst)
        .mockRejectedValue(new Error("DB Connection Error"));

      const req = new NextRequest("http://localhost/api/documents/doc-123", {
        method: "DELETE",
        headers: { cookie: "accessToken=valid_token" },
      });

      const res = await DELETE(req, {
        params: Promise.resolve({ id: "doc-123" }),
      });
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Failed to delete document");
    });
  });

})