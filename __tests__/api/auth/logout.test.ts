import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout Unit Tests", () => {
  it("should return 200 and clear auth cookies", async () => {
    const res = await POST();
    const data = await res.json();

    // Verify status code and message
    expect(res.status).toBe(200);
    expect(data.message).toBe("Logged out successfully");

    // Verify accessToken cookie is cleared (empty value & maxAge 0)
    const accessCookie = res.cookies.get("accessToken");
    expect(accessCookie).toBeDefined();
    expect(accessCookie?.value).toBe("");

    // Verify refreshToken cookie is cleared (empty value & maxAge 0)
    const refreshCookie = res.cookies.get("refreshToken");
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie?.value).toBe("");
  });
});