import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { LoginSchema } from "@/lib/validatons/auth/auth";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/token";
import { logger } from "@/lib/logger"; // 👈 Make sure this path points to your logger file!

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 🟢 Log the incoming attempt (DO NOT log raw passwords for security!)
    logger.info({ email: body?.email }, "🔑 Login attempt initiated");

    // 1. Validate request body
    const validation = LoginSchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.issues[0].message;

      // ⚠️ Log data validation failures as warnings
      logger.warn({ error: errorMessage }, "⚠️ Login payload validation failed");

      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const { email, password } = validation.data;

    // 2. Fetch user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // ⚠️ Log invalid emails as warnings (helps identify brute-force enumeration attacks)
      logger.warn({ email }, "❌ Login failed: Email not found");

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // ⚠️ Log wrong password events as warnings
      logger.warn({ email, userId: user.id }, "❌ Login failed: Incorrect password");

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // 4. Generate Tokens
    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken(user.id);

    // 5. Build response object (no longer returning accessToken in JSON body)
    const response = NextResponse.json(
      {
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      { status: 200 }
    );

    // 6. Set Access Token Cookie (Short-lived, e.g., 15 minutes)
    response.cookies.set({
      name: "accessToken",
      value: accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 15 * 60, // 15 minutes
    });

    // 7. Set Refresh Token Cookie (Long-lived, 7 days)
    response.cookies.set({
      name: "refreshToken",
      value: refreshToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // 🟢 Log successful logins to keep an audit trail
    logger.info({ userId: user.id, email: user.email }, "🎉 Login successful, cookies dispatched");

    return response;
  } catch (error) {
    // 🔴 Crucial change: Replaced console.error with your strict error tracker
    logger.error({ err: error }, "🚨 Unhandled critical error during login route execution");

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
