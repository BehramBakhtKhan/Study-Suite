import { GET, DELETE } from "@/app/api/documents/[id]/route";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

describe("API /api/documents/[id] Integration Tests", () => {
  let testUserId: string;
  let otherUserId: string;
  let validToken: string;

  beforeEach(async () => {
    // 1. Spy on fs.unlink to avoid physical disk errors
    jest.spyOn(fs, "unlink").mockResolvedValue(undefined as any);

    // 2. Seed primary test user in PostgreSQL
    const user = await prisma.user.create({
      data: {
        username: "behramsingle",
        email: "behramsingle@gmail.com",
        passwordHash: "hashedpass123",
      },
    });

    testUserId = user.id;

    // 3. Seed secondary user for authorization/isolation testing
    const otherUser = await prisma.user.create({
      data: {
        username: "otheruser",
        email: "otheruser@gmail.com",
        passwordHash: "hashedpass123",
      },
    });

    otherUserId = otherUser.id;

    // 4. Sign valid JWT matching route verification logic
    validToken = jwt.sign(
      { userId: testUserId },
      process.env.JWT_ACCESS_SECRET || "your-secret-key"
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ==========================================
  // GET /api/documents/[id]
  // ==========================================
  describe("GET /api/documents/[id]", () => {
    it("should return 401 if access token cookie is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/doc-123", {
        method: "GET",
      });

      const params = Promise.resolve({ id: "doc-123" });
      const res = await GET(req, { params });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should return 404 if document does not exist in database", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/documents/non-existent-id",
        { method: "GET" }
      );
      req.cookies.set("accessToken", validToken);

      const params = Promise.resolve({ id: "non-existent-id" });
      const res = await GET(req, { params });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Document not found");
    });

    it("should return 404 if trying to fetch another user's document", async () => {
      // Seed document belonging to otherUserId
      const otherDoc = await prisma.document.create({
        data: {
          userId: otherUserId,
          title: "Private Doc",
          filePath: "/uploads/private.pdf",
          extractedText: "Secret Content",
          textHash: "private_hash",
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/documents/${otherDoc.id}`,
        { method: "GET" }
      );
      req.cookies.set("accessToken", validToken); // Auth as testUserId

      const params = Promise.resolve({ id: otherDoc.id });
      const res = await GET(req, { params });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Document not found");
    });

    it("should return 200 and the document details when authorized", async () => {
      // Seed document for testUserId
      const userDoc = await prisma.document.create({
        data: {
          userId: testUserId,
          title: "My Operating Systems Notes",
          filePath: "/uploads/os_notes.pdf",
          extractedText: "Process Scheduling and Threads",
          summary: "Summary of OS concepts",
          textHash: "os_hash_123",
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/documents/${userDoc.id}`,
        { method: "GET" }
      );
      req.cookies.set("accessToken", validToken);

      const params = Promise.resolve({ id: userDoc.id });
      const res = await GET(req, { params });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.document).toBeDefined();
      expect(data.document.id).toBe(userDoc.id);
      expect(data.document.title).toBe("My Operating Systems Notes");
    });
  });

  // ==========================================
  // DELETE /api/documents/[id]
  // ==========================================
  describe("DELETE /api/documents/[id]", () => {
    it("should return 401 if access token cookie is missing", async () => {
      const req = new NextRequest("http://localhost:3000/api/documents/doc-123", {
        method: "DELETE",
      });

      const params = Promise.resolve({ id: "doc-123" });
      const res = await DELETE(req, { params });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.error).toBe("Access token missing or invalid");
    });

    it("should return 404 if trying to delete a non-existent document", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/documents/non-existent-id",
        { method: "DELETE" }
      );
      req.cookies.set("accessToken", validToken);

      const params = Promise.resolve({ id: "non-existent-id" });
      const res = await DELETE(req, { params });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Document not found");
    });

    it("should return 404 if trying to delete another user's document", async () => {
      const otherDoc = await prisma.document.create({
        data: {
          userId: otherUserId,
          title: "Protected Doc",
          filePath: "/uploads/protected.pdf",
          extractedText: "Protected Content",
          textHash: "protected_hash",
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/documents/${otherDoc.id}`,
        { method: "DELETE" }
      );
      req.cookies.set("accessToken", validToken);

      const params = Promise.resolve({ id: otherDoc.id });
      const res = await DELETE(req, { params });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.error).toBe("Document not found");

      // Confirm record was NOT deleted in PostgreSQL
      const dbDoc = await prisma.document.findUnique({
        where: { id: otherDoc.id },
      });
      expect(dbDoc).not.toBeNull();
    });

    it("should successfully delete user document and trigger file cleanup", async () => {
      const relativeFilePath = "/uploads/os_to_delete.pdf";

      const userDoc = await prisma.document.create({
        data: {
          userId: testUserId,
          title: "OS Notes To Delete",
          filePath: relativeFilePath,
          extractedText: "Content to be deleted",
          textHash: "delete_hash_123",
        },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/documents/${userDoc.id}`,
        { method: "DELETE" }
      );
      req.cookies.set("accessToken", validToken);

      const params = Promise.resolve({ id: userDoc.id });
      const res = await DELETE(req, { params });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.message).toBe("Document deleted successfully");

      // Verify deletion from PostgreSQL
      const dbDoc = await prisma.document.findUnique({
        where: { id: userDoc.id },
      });
      expect(dbDoc).toBeNull();

      // Verify fs.unlink was called with full resolved path
      const expectedPath = path.join(process.cwd(), "public", relativeFilePath);
      expect(fs.unlink).toHaveBeenCalledWith(expectedPath);
    });
  });
});