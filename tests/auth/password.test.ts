import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("hashPassword", () => {
  it("returns a string hash", async () => {
    const hash = await hashPassword("testpassword");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("produces different hashes for same password (unique salts)", async () => {
    const hash1 = await hashPassword("testpassword");
    const hash2 = await hashPassword("testpassword");
    expect(hash1).not.toBe(hash2);
  });

  it("produces hashes starting with $2a$ (bcrypt)", async () => {
    const hash = await hashPassword("testpassword");
    expect(hash).toMatch(/^\$2[a-z]\$/);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await verifyPassword("correctpassword", hash);
    expect(result).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });

  it("returns false for empty string against non-empty hash", async () => {
    const hash = await hashPassword("password");
    const result = await verifyPassword("", hash);
    expect(result).toBe(false);
  });
});
