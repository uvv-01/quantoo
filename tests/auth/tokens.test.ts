import { describe, it, expect } from "vitest";
import {
  generateToken,
  hashToken,
  createSessionToken,
  createVerificationToken,
  createPasswordResetToken,
} from "@/lib/auth/tokens";

describe("generateToken", () => {
  it("returns a hex string of expected length", () => {
    const token = generateToken(32);
    expect(token).toMatch(/^[0-9a-f]+$/);
    // 32 bytes = 64 hex chars
    expect(token.length).toBe(64);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateToken(16)),
    );
    expect(tokens.size).toBe(100);
  });

  it("supports custom byte length", () => {
    const token = generateToken(16);
    // 16 bytes = 32 hex chars
    expect(token.length).toBe(32);
  });
});

describe("hashToken", () => {
  it("returns a hex string", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("returns consistent hashes for same input", () => {
    const hash1 = hashToken("test-token");
    const hash2 = hashToken("test-token");
    expect(hash1).toBe(hash2);
  });

  it("returns different hashes for different inputs", () => {
    const hash1 = hashToken("token-1");
    const hash2 = hashToken("token-2");
    expect(hash1).not.toBe(hash2);
  });

  it("returns 64-char SHA-256 hash", () => {
    const hash = hashToken("test");
    expect(hash.length).toBe(64);
  });
});

describe("createSessionToken", () => {
  it("returns raw and hash", () => {
    const { raw, hash } = createSessionToken();
    expect(typeof raw).toBe("string");
    expect(typeof hash).toBe("string");
    expect(raw.length).toBe(64);
    expect(hash.length).toBe(64);
  });

  it("hash matches hashToken(raw)", () => {
    const { raw, hash } = createSessionToken();
    expect(hash).toBe(hashToken(raw));
  });

  it("generates unique tokens", () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => createSessionToken().raw),
    );
    expect(tokens.size).toBe(50);
  });
});

describe("createVerificationToken", () => {
  it("returns raw and hash", () => {
    const { raw, hash } = createVerificationToken();
    expect(typeof raw).toBe("string");
    expect(typeof hash).toBe("string");
  });
});

describe("createPasswordResetToken", () => {
  it("returns raw and hash", () => {
    const { raw, hash } = createPasswordResetToken();
    expect(typeof raw).toBe("string");
    expect(typeof hash).toBe("string");
  });
});
