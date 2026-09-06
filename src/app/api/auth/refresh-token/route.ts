import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from "@/lib/auth/token";

export async function POST(req: NextRequest) {
  try {
    // 1. Read the HTTP-only refresh token cookie
    const refreshToken = req.cookies.get("refreshToken")?.value;

    if (!refreshToken) {
      console.log("❌ Refresh failed: No refreshToken cookie found in request");
      return NextResponse.json(
        { error: "Refresh token missing" },
        { status: 401 }
      );
    }

    // 2. Verify the refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // 3. Confirm user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      console.log("❌ Refresh failed: User not found in DB");
      return NextResponse.json(
        { error: "User no longer exists" },
        { status: 401 }
      );
    }

    // 4. Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const newRefreshToken = generateRefreshToken(user.id);

    const response = NextResponse.json(
      { message: "Token refreshed successfully" },
      { status: 200 }
    );

    // 5. Set Access Token Cookie (15-minute expiration)
    response.cookies.set("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60, // 15 minutes
    });

    // 6. Set Refresh Token Cookie (15-day expiration)
    response.cookies.set("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 24 * 60 * 60, // 15 days
    });

    return response;
  } catch (error) {
    console.error("❌ Refresh verification failed:", error);
    return NextResponse.json(
      { error: "Invalid or expired refresh token" },
      { status: 401 }
    );
  }
}