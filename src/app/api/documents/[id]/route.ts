import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import fs from "fs/promises";
import path from "path";

interface JwtPayload {
  userId: string;
}

// Helper to extract and verify userId from accessToken cookie
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

// GET /api/documents/[id] - Fetch single document details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromCookie(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    const document = await prisma.document.findFirst({
      where: { id, userId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document }, { status: 200 });
  } catch (error) {
    console.error("GET /api/documents/[id] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}

// DELETE /api/documents/[id] - Delete document record & physical file
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = getUserIdFromCookie(req);

    if (!userId) {
      return NextResponse.json(
        { error: "Access token missing or invalid" },
        { status: 401 }
      );
    }

    // 1. Check if document exists and belongs to user
    const document = await prisma.document.findFirst({
      where: { id, userId },
    });

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // 2. Remove physical file from public/uploads
    if (document.filePath) {
      const fullFilePath = path.join(process.cwd(), "public", document.filePath);
      try {
        await fs.unlink(fullFilePath);
      } catch (fileErr) {
        console.warn("File cleanup warning (file may not exist on disk):", fileErr);
      }
    }

    // 3. Delete database record
    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: "Document deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("DELETE /api/documents/[id] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}