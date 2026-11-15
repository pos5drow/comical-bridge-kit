/**
 * AES-CBC decryption (FIPS 197, SP 800-38A) for sites that ship encrypted data a page script decrypts
 * with a key in plain sight (CryptoJS and the like). Not for security: embedded engines have no
 * `crypto.subtle`, and the lists involved are small, so this favours clarity over speed.
 */

let SBOX: Uint8Array | undefined;
let INV: Uint8Array | undefined;

/** The S-box and its inverse, built on first use so a bundle that never decrypts doesn't change. */
function tables(): [Uint8Array, Uint8Array] {
  if (SBOX && INV) return [SBOX, INV];
  const sbox = new Uint8Array(256);
  const inv = new Uint8Array(256);
  let p = 1;
  let q = 1;
  do {
    // p walks the multiplicative group by 3, q by its inverse (3⁻¹ = 0xf6).
    p = p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0);
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09;
    const x = q ^ rotl(q, 1) ^ rotl(q, 2) ^ rotl(q, 3) ^ rotl(q, 4) ^ 0x63;
    sbox[p] = x;
    inv[x] = p;
  } while (p !== 1);
  sbox[0] = 0x63;
  inv[0x63] = 0;
  SBOX = sbox;
  INV = inv;
  return [sbox, inv];
}

const rotl = (x: number, n: number) => ((x << n) | (x >> (8 - n))) & 0xff;
const xtime = (x: number) => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;

function mul(a: number, b: number): number {
  let r = 0;
  while (b) {
    if (b & 1) r ^= a;
    a = xtime(a);
    b >>= 1;
  }
  return r;
}

/** The round keys, as (rounds + 1) × 16 bytes. */
function expandKey(key: Uint8Array, sbox: Uint8Array): { w: Uint8Array; rounds: number } {
  if (key.length !== 16 && key.length !== 24 && key.length !== 32) throw new Error(`aes: key must be 16, 24 or 32 bytes, not ${key.length}`);
  const nk = key.length / 4;
  const rounds = nk + 6;
  const w = new Uint8Array(16 * (rounds + 1));
  w.set(key);
  let rcon = 1;
  for (let i = nk; i < 4 * (rounds + 1); i++) {
    let t = [w[4 * i - 4]!, w[4 * i - 3]!, w[4 * i - 2]!, w[4 * i - 1]!];
    if (i % nk === 0) {
      t = [sbox[t[1]!]! ^ rcon, sbox[t[2]!]!, sbox[t[3]!]!, sbox[t[0]!]!];
      rcon = xtime(rcon);
    } else if (nk > 6 && i % nk === 4) {
      t = t.map((b) => sbox[b]!);
    }
    for (let j = 0; j < 4; j++) w[4 * i + j] = w[4 * (i - nk) + j]! ^ t[j]!;
  }
  return { w, rounds };
}

function decryptBlock(block: Uint8Array, w: Uint8Array, rounds: number, inv: Uint8Array): Uint8Array {
  const s = Uint8Array.from(block);
  const addRoundKey = (r: number) => {
    for (let i = 0; i < 16; i++) s[i]! ^= w[16 * r + i]!;
  };
  addRoundKey(rounds);
  for (let r = rounds - 1; r >= 0; r--) {
    // Inverse ShiftRows: row n (bytes n, n+4, …) rotates right by n.
    const t = Uint8Array.from(s);
    for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) s[4 * ((c + row) % 4) + row] = t[4 * c + row]!;
    for (let i = 0; i < 16; i++) s[i] = inv[s[i]!]!;
    addRoundKey(r);
    if (r === 0) break;
    for (let c = 0; c < 4; c++) {
      const [a, b, d, e] = [s[4 * c]!, s[4 * c + 1]!, s[4 * c + 2]!, s[4 * c + 3]!];
      s[4 * c] = mul(a, 14) ^ mul(b, 11) ^ mul(d, 13) ^ mul(e, 9);
      s[4 * c + 1] = mul(a, 9) ^ mul(b, 14) ^ mul(d, 11) ^ mul(e, 13);
      s[4 * c + 2] = mul(a, 13) ^ mul(b, 9) ^ mul(d, 14) ^ mul(e, 11);
      s[4 * c + 3] = mul(a, 11) ^ mul(b, 13) ^ mul(d, 9) ^ mul(e, 14);
    }
  }
  return s;
}

/**
 * Decrypt AES-CBC `data` (a whole number of 16-byte blocks) with `key` (16/24/32 bytes) and a
 * 16-byte `iv`. Padding is left in place: strip it with {@link stripZeroPadding} or
 * {@link stripPkcs7}, whichever the site used.
 */
export function aesCbcDecrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  if (iv.length !== 16) throw new Error(`aes: iv must be 16 bytes, not ${iv.length}`);
  if (data.length % 16 !== 0) throw new Error("aes: data isn't a whole number of blocks");
  const [sbox, inv] = tables();
  const { w, rounds } = expandKey(key, sbox);
  const out = new Uint8Array(data.length);
  let prev = iv;
  for (let off = 0; off < data.length; off += 16) {
    const block = data.subarray(off, off + 16);
    const plain = decryptBlock(block, w, rounds, inv);
    for (let i = 0; i < 16; i++) out[off + i] = plain[i]! ^ prev[i]!;
    prev = block;
  }
  return out;
}

/** `bytes` without trailing zero bytes (CryptoJS's `ZeroPadding`). */
export function stripZeroPadding(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return bytes.subarray(0, end);
}

/** `bytes` without PKCS#7 padding; unchanged when the padding isn't valid. */
export function stripPkcs7(bytes: Uint8Array): Uint8Array {
  const n = bytes[bytes.length - 1] ?? 0;
  if (n < 1 || n > 16 || n > bytes.length) return bytes;
  for (let i = bytes.length - n; i < bytes.length; i++) if (bytes[i] !== n) return bytes;
  return bytes.subarray(0, bytes.length - n);
}
