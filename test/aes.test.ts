import { expect, test } from "bun:test";
import { aesCbcDecrypt, stripPkcs7, stripZeroPadding } from "../src/aes.ts";

const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

// NIST SP 800-38A, F.2.2 / F.2.4 / F.2.6 (CBC decrypt, four blocks).
const IV = "000102030405060708090a0b0c0d0e0f";
const PLAIN = "6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e5130c81c46a35ce411e5fbc1191a0a52eff69f2445df4f9b17ad2b417be66c3710";
const CASES: [string, string, string][] = [
  ["AES-128", "2b7e151628aed2a6abf7158809cf4f3c", "7649abac8119b246cee98e9b12e9197d5086cb9b507219ee95db113a917678b273bed6b8e3c1743b7116e69e222295163ff1caa1681fac09120eca307586e1a7"],
  ["AES-192", "8e73b0f7da0e6452c810f32b809079e562f8ead2522c6b7b", "4f021db243bc633d7178183a9fa071e8b4d9ada9ad7dedf4e5e738763f69145a571b242012fb7ae07fa9baac3df102e008b0e27988598881d920a9e64f5615cd"],
  ["AES-256", "603deb1015ca71be2b73aef0857d77811f352c073b6108d72d9810a30914dff4", "f58c4c04d6e5f1ba779eabfb5f7bfbd69cfc4e967edb808d679f777bc6702c7d39f23369a9d9bacfa530e26304231461b2eb05e2c39be9fcda6c19078c6a9d1b"],
];

for (const [name, key, cipher] of CASES) {
  test(`${name}-CBC decrypts the NIST vectors`, () => {
    expect(toHex(aesCbcDecrypt(hex(cipher), hex(key), hex(IV)))).toBe(PLAIN);
  });
}

test("bad sizes are refused", () => {
  expect(() => aesCbcDecrypt(new Uint8Array(15), new Uint8Array(16), new Uint8Array(16))).toThrow(/blocks/);
  expect(() => aesCbcDecrypt(new Uint8Array(16), new Uint8Array(10), new Uint8Array(16))).toThrow(/key/);
  expect(() => aesCbcDecrypt(new Uint8Array(16), new Uint8Array(16), new Uint8Array(8))).toThrow(/iv/);
});

test("padding helpers", () => {
  expect(Array.from(stripZeroPadding(Uint8Array.from([1, 2, 0, 0])))).toEqual([1, 2]);
  expect(Array.from(stripPkcs7(Uint8Array.from([1, 2, 2, 2])))).toEqual([1, 2]);
  expect(Array.from(stripPkcs7(Uint8Array.from([1, 2, 3, 2])))).toEqual([1, 2, 3, 2]);
});
