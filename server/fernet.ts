import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Pure Node.js Fernet implementation fully compatible with Python's `cryptography.fernet.Fernet`.
 * 
 * Spec:
 * - Key: 32-byte URL-safe base64 string (16 bytes for AES-128 key + 16 bytes for HMAC-SHA256 key)
 * - Token: Base64URL( 0x80 (1 byte) || Timestamp (8 bytes, uint64 big-endian) || IV (16 bytes) || Ciphertext (PKCS7 padded AES-128-CBC) || HMAC-SHA256 (32 bytes) )
 */
export class FernetCipher {
  private signingKey: Buffer;
  private encryptionKey: Buffer;
  private rawKeyString: string;

  constructor(keyString: string) {
    const raw = Buffer.from(keyString.trim(), 'base64');
    if (raw.length !== 32) {
      throw new Error(`Invalid Fernet key: must be 32 bytes (got ${raw.length} bytes)`);
    }
    this.signingKey = raw.subarray(0, 16);
    this.encryptionKey = raw.subarray(16, 32);
    this.rawKeyString = keyString.trim();
  }

  static generateKey(): string {
    const randomBytes = crypto.randomBytes(32);
    return randomBytes.toString('base64');
  }

  getKeyString(): string {
    return this.rawKeyString;
  }

  getKeyFingerprint(): string {
    return crypto.createHash('sha256').update(this.rawKeyString).digest('hex').substring(0, 12);
  }

  encrypt(data: Buffer | string): string {
    const payload = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    const version = Buffer.from([0x80]);
    
    // 8-byte big-endian timestamp in seconds
    const timestampSec = Math.floor(Date.now() / 1000);
    const timestampBuf = Buffer.alloc(8);
    timestampBuf.writeBigUInt64BE(BigInt(timestampSec), 0);

    // 16-byte random IV
    const iv = crypto.randomBytes(16);

    // AES-128-CBC encryption with PKCS#7 padding
    const cipher = crypto.createCipheriv('aes-128-cbc', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);

    // Data to sign: version || timestamp || iv || ciphertext
    const basicParts = Buffer.concat([version, timestampBuf, iv, ciphertext]);

    // HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(basicParts);
    const signature = hmac.digest();

    // Final token: basicParts || signature encoded in URL-safe base64
    const fullToken = Buffer.concat([basicParts, signature]);
    return fullToken.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  }

  decrypt(token: string): string {
    // Normalize URL-safe base64 back to standard base64
    let b64 = token.trim().replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const tokenBuf = Buffer.from(b64, 'base64');

    if (tokenBuf.length < 57) {
      throw new Error('Invalid Fernet token: length too short');
    }

    const version = tokenBuf[0];
    if (version !== 0x80) {
      throw new Error(`Unsupported Fernet token version: 0x${version.toString(16)}`);
    }

    const basicParts = tokenBuf.subarray(0, tokenBuf.length - 32);
    const signature = tokenBuf.subarray(tokenBuf.length - 32);

    // Verify HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(basicParts);
    const expectedSig = hmac.digest();

    if (!crypto.timingSafeEqual(signature, expectedSig)) {
      throw new Error('HMAC signature verification failed. Incorrect secret.key or corrupted data.');
    }

    const iv = basicParts.subarray(9, 25);
    const ciphertext = basicParts.subarray(25);

    // Decrypt AES-128-CBC
    const decipher = crypto.createDecipheriv('aes-128-cbc', this.encryptionKey, iv);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return decrypted.toString('utf8');
  }
}

export const KEY_FILE_PATH = path.join(process.cwd(), 'secret.key');
export const VAULT_DIR_PATH = path.join(process.cwd(), 'vault');

export function ensureKeyAndVault(): { cipher: FernetCipher; keyExists: boolean; keyCreated: boolean } {
  if (!fs.existsSync(VAULT_DIR_PATH)) {
    fs.mkdirSync(VAULT_DIR_PATH, { recursive: true });
  }

  let keyCreated = false;
  let keyExists = fs.existsSync(KEY_FILE_PATH);

  if (!keyExists) {
    const newKey = FernetCipher.generateKey();
    fs.writeFileSync(KEY_FILE_PATH, newKey, 'utf8');
    keyCreated = true;
    keyExists = true;
  }

  const keyContent = fs.readFileSync(KEY_FILE_PATH, 'utf8').trim();
  const cipher = new FernetCipher(keyContent);

  return { cipher, keyExists, keyCreated };
}
