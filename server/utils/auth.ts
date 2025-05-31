import jwt from 'jsonwebtoken';
import { H3Event, parseCookies } from 'h3';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

// Define an interface for the options used by crypto.scrypt
interface ScryptOptions {
  cost: number;
  blockSize: number;
  parallelization: number;
  maxmem: number;
}

// Helper function to wrap crypto.scrypt in a promise
function scryptPromise(password: Buffer, salt: Buffer, keylen: number, options?: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Pass options or an empty object if options is undefined
    scrypt(password, salt, keylen, options ?? {}, (err, derivedKey) => {
      if (err) {
        reject(err);
      } else {
        resolve(derivedKey);
      }
    });
  });
}

// Scrypt parameters (Node defaults: N=16384, r=8, p=1, keylen=64)
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAXMEM = 32 * 1024 * 1024 * 2;

// PHC string identifier
const SCRYPT_ID = '$scrypt$';
const SCRYPT_PARAMS = `ln=${Math.log2(SCRYPT_N)},r=${SCRYPT_R},p=${SCRYPT_P}`;

/**
 * Hashes a password using scrypt with recommended parameters.
 * Stores the hash along with parameters and salt in PHC string format.
 * @param password The plaintext password.
 * @returns A promise resolving to the scrypt hash string.
 */
async function hashPasswordScrypt(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);

  const scryptOptions: ScryptOptions = {
    cost: SCRYPT_N,
    blockSize: SCRYPT_R,
    parallelization: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  };

  const passwordBuffer = Buffer.from(password, 'utf8'); // Convert password to Buffer
  const hash = await scryptPromise(passwordBuffer, salt, SCRYPT_KEYLEN, scryptOptions); // Use buffer
  return `${SCRYPT_ID}${SCRYPT_PARAMS}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * Verifies a password against a stored scrypt hash string (PHC format).
 * @param password The plaintext password to verify.
 * @param storedHash The stored hash string (including parameters and salt).
 * @returns A promise resolving to true if the password matches, false otherwise.
 */
async function verifyPasswordScrypt(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 5 || parts[1] !== 'scrypt' || !parts[2].startsWith('ln=')) {
      return false;
    }
    const salt = Buffer.from(parts[3], 'base64');
    const storedHashBytes = Buffer.from(parts[4], 'base64');

    if (salt.length !== SCRYPT_SALT_BYTES || storedHashBytes.length !== SCRYPT_KEYLEN) {
      return false;
    }

    const params = parsePhcParams(parts[2]);
    const scryptOptions: ScryptOptions = {
      cost: Math.pow(2, params.ln),
      blockSize: params.r,
      parallelization: params.p,
      maxmem: SCRYPT_MAXMEM,
    };

    const passwordBuffer = Buffer.from(password, 'utf8'); // Convert password to Buffer
    const derivedHash = await scryptPromise(passwordBuffer, salt, storedHashBytes.length, scryptOptions); // Use buffer

    if (derivedHash.length !== storedHashBytes.length) {
      return false;
    }

    return timingSafeEqual(derivedHash, storedHashBytes);
  } catch (error) {
    console.error('Error verifying scrypt password:', error);
    return false;
  }
}

// Helper function to parse PHC parameters from a string
function parsePhcParams(paramsStr: string): { ln: number; r: number; p: number } {
  const params = paramsStr.split(',');
  const ln = parseInt(params[0].split('=')[1], 10);
  const r = parseInt(params[1].split('=')[1], 10);
  const p = parseInt(params[2].split('=')[1], 10);
  return { ln, r, p };
}

// --- Modified Existing Functions ---

/**
 * Hashes a password using the currently configured method (scrypt).
 * @param password The plaintext password.
 * @returns A promise resolving to the hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  return hashPasswordScrypt(password);
}

interface VerificationResult {
  success: boolean;
  method: 'scrypt' | 'bcrypt' | null;
}

/**
 * Verifies a password against a stored hash.
 * It tries scrypt first, then falls back to bcryptjs for migration purposes.
 * @param password The plaintext password to verify.
 * @param hash The stored hash string (can be bcryptjs or scrypt format).
 * @returns A promise resolving to an object indicating success and the method used.
 */
export async function verifyPassword(password: string, hash: string): Promise<VerificationResult> {
  if (hash.startsWith(SCRYPT_ID)) {
    const isScryptValid = await verifyPasswordScrypt(password, hash);
    return { success: isScryptValid, method: isScryptValid ? 'scrypt' : null };
  } else {
    // If it's not scrypt, immediately fail verification.
    // Users with old bcrypt hashes will need to reset their password.
    console.warn(`Attempted login with non-scrypt hash for user (hash starts with: ${hash.substring(0, 10)}...). Failing verification.`);
    return { success: false, method: null };
  }
}

// Generate JWT token
export const generateToken = ({ userId, email, name }: { userId: string, email: string, name: string }): string => {
  const config = useRuntimeConfig();
  return jwt.sign(
    { userId, email, name },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
};

// Verify JWT token
export const verifyToken = (token: string): any => {
  const config = useRuntimeConfig();
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

// Get user from request
export const getUserFromEvent = async (event: H3Event): Promise<{ userId: string; name: string; email: string } | null> => {
  const authHeader = getHeader(event, 'Authorization');
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : null;
 
  const cookieToken = parseCookies(event)['auth_token'];
  // there is a bug in the client side that doens't send the cookie server side
  // so we need to check both so we can have independent clients, like mobile and web

  if (!bearerToken && !cookieToken) {
    return null;
  }
  
  const user = verifyToken(bearerToken || '') || verifyToken(cookieToken || '');
  if (!user) return null;
  return {
    userId: user.userId,
    name: user.name,
    email: user.email,
  };
};

// Get cookie from request
export const getCookieFromEvent = (event: H3Event, name: string): string | null => {
  const cookies = parseCookies(event);
  return cookies[name] || null;
};

// Check if user is authenticated
export const isAuthenticated = (event: H3Event): boolean => {
  const user = getUserFromEvent(event);
  return !!user;
};
