const PBKDF2_ITERATIONS = 100_000;
const HASH_BITS = 256;

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

/**
 * Derive a PBKDF2-SHA256 hash. The storeKey is used as a per-store salt so
 * identical passwords across stores produce different hashes, which makes
 * bulk credential cracking from a leaked DB dump significantly harder.
 */
export const hashPassword = async (password: string, storeKey: string): Promise<string> => {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: enc.encode(`toriyaro-eisei:${storeKey}`),
      iterations: PBKDF2_ITERATIONS,
    },
    baseKey,
    HASH_BITS,
  );
  return toHex(bits);
};

export const verifyPassword = async (
  password: string,
  storeKey: string,
  expectedHash: string,
): Promise<boolean> => {
  const computed = await hashPassword(password, storeKey);
  // constant-time-ish comparison (length-checked + char xor)
  if (computed.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i += 1) {
    diff |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
};
