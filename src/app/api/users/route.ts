import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

interface JwtPayload {
  userId: string;
  role: string;
}

export async function GET(req: NextRequest) {
  try {

    // 1. Extract accessToken from HTTP-only cookie
    const token = req.cookies.get("accessToken")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized access: Missing token" },
        { status: 401 }
      );
    }

    // 2. Verify JWT token
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || "your-secret-key"
      ) as JwtPayload;
    } catch {
      return NextResponse.json(
        { error: "Unauthorized access: Invalid or expired token" },
        { status: 401 }
      );
    }

    // 3. Admin Authorization Guard
    if (decoded.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 4. Fetch all users from PostgreSQL
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Fetch Users Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}