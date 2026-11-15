import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { md5 } from "../src/index.ts";

describe("md5", () => {
  test.each([
    ["", "d41d8cd98f00b204e9800998ecf8427e"],
    ["a", "0cc175b9c0f1b6a831c399e269772661"],
    ["abc", "900150983cd24fb0d6963f7d28e17f72"],
    ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
    ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
    ["12345678901234567890123456789012345678901234567890123456789012345678901234567890", "57edf4a22be3c955ac49da2e2107b67a"],
  ])("RFC 1321: %p", (input, hex) => expect(md5(input)).toBe(hex));

  test("matches node's MD5 across block boundaries and non-ASCII text", () => {
    for (const s of ["x".repeat(55), "x".repeat(56), "x".repeat(64), "x".repeat(1000), "capítulo 漫画 🎉"]) {
      expect(md5(s)).toBe(createHash("md5").update(s, "utf8").digest("hex"));
    }
  });
});
