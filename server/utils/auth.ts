// server/utils/auth.ts
import jwt from 'jsonwebtoken';
import { H3Event, parseCookies, getCookie, getHeader, H3Error } from 'h3'; // Added parseCookies, getCookie, getHeader, H3Error
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { useRuntimeConfig } from '#imports'; // Added Nuxt auto-import

// Define an interface for the options used by crypto.scrypt
interface ScryptOptions {
  cost: number;
  blockSize: number;
  parallelization: number;
  maxmem: number;
}

// Define structure for decoded JWT payload
// Adapt this based on what you actually put in the token (currently userId, email)
export interface UserPayload {
  userId: number; // Changed from string to number based on schema
  email: string;
  // Add role and name if they are included in the token
  // role?: string; 
  // name?: string;
}


// Helper function to wrap crypto.scrypt in a promise
function scryptPromise(password: Buffer, salt: Buffer, keylen: number, options?: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
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
const SCRYPT_MAXMEM = 32 * 1024 * 1024 * 2; // Adjusted MaxMem based on defaults (approx 64MiB)

// PHC string identifier
const SCRYPT_ID = '$scrypt$';
const SCRYPT_PARAMS = `ln=${Math.log2(SCRYPT_N)},r=${SCRYPT_R},p=${SCRYPT_P}`;

/**
 * Hashes a password using scrypt with recommended parameters.
 * Stores the hash along with parameters and salt in PHC string format.
 * @param password The plaintext password.
 * @returns A promise resolving to the scrypt hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const scryptOptions: ScryptOptions = {
    cost: SCRYPT_N,
    blockSize: SCRYPT_R,
    parallelization: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  };
  const passwordBuffer = Buffer.from(password, 'utf8');
  const hash = await scryptPromise(passwordBuffer, salt, SCRYPT_KEYLEN, scryptOptions);
  // Ensure salt and hash are Base64 encoded *without* padding for PHC standard
  return `${SCRYPT_ID}${SCRYPT_PARAMS}$${salt.toString('base64').replace(/=+$/, '')}$${hash.toString('base64').replace(/=+$/, '')}`;
}


/**
 * Verifies a password against a stored scrypt hash string (PHC format).
 * @param password The plaintext password to verify.
 * @param storedHash The stored hash string (including parameters and salt).
 * @returns A promise resolving to true if the password matches, false otherwise.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 5 || parts[1] !== 'scrypt' || !parts[2].startsWith('ln=')) {
      console.error('Invalid PHC string format');
      return false;
    }

    // Add back padding if necessary for Buffer.from
    const saltB64 = parts[3].padEnd(parts[3].length + (4 - parts[3].length % 4) % 4, '=');
    const storedHashB64 = parts[4].padEnd(parts[4].length + (4 - parts[4].length % 4) % 4, '=');

    const salt = Buffer.from(saltB64, 'base64');
    const storedHashBytes = Buffer.from(storedHashB64, 'base64');

    if (salt.length !== SCRYPT_SALT_BYTES /* Salt length check is often debated, but included here */) {
        console.error(`Invalid salt length: expected ${SCRYPT_SALT_BYTES}, got ${salt.length}`);
        return false;
    }
     if (storedHashBytes.length !== SCRYPT_KEYLEN) {
        console.error(`Invalid hash length: expected ${SCRYPT_KEYLEN}, got ${storedHashBytes.length}`);
        return false;
    }


    const params = parsePhcParams(parts[2]);
    const scryptOptions: ScryptOptions = {
      cost: Math.pow(2, params.ln),
      blockSize: params.r,
      parallelization: params.p,
      maxmem: SCRYPT_MAXMEM,
    };

    const passwordBuffer = Buffer.from(password, 'utf8');
    const derivedHash = await scryptPromise(passwordBuffer, salt, storedHashBytes.length, scryptOptions);

    if (derivedHash.length !== storedHashBytes.length) {
       console.error(`Derived hash length mismatch: expected ${storedHashBytes.length}, got ${derivedHash.length}`);
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
  const paramsMap = paramsStr.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      acc[key] = parseInt(value, 10);
    }
    return acc;
  }, {} as Record<string, number>);

  if (isNaN(paramsMap.ln) || isNaN(paramsMap.r) || isNaN(paramsMap.p)) {
     throw new Error('Invalid PHC parameters string');
  }
  return { ln: paramsMap.ln, r: paramsMap.r, p: paramsMap.p };
}


// Generate JWT token
// IMPORTANT: Adapt payload (userId, email, role, name) based on actual DB user structure and needs
export const generateToken = (payload: UserPayload): string => {
  const config = useRuntimeConfig();
  if (!config.jwtSecret) {
    throw new Error('JWT_SECRET is not defined in runtime config');
  }
  return jwt.sign(
    payload, // Use the provided payload directly
    config.jwtSecret,
    { expiresIn: '7d' } // Consider making expiry configurable
  );
};

// Verify JWT token
export const verifyToken = (token: string): UserPayload | null => {
  const config = useRuntimeConfig();
   if (!config.jwtSecret) {
    console.error('JWT_SECRET is not defined in runtime config for verification');
    return null; // Cannot verify without secret
  }
  try {
    // Explicitly cast to UserPayload after verification
    return jwt.verify(token, config.jwtSecret) as UserPayload;
  } catch (error) {
     if (error instanceof Error) {
        console.error('JWT Verification Error:', error.message);
     } else {
        console.error('Unknown JWT Verification Error:', error);
     }
    return null;
  }
};

// Get user from request (checks cookie first, then Bearer token)
export const getUserFromEvent = (event: H3Event): UserPayload | null => {
  let token: string | null = null;

  // 1. Try reading the cookie
  const cookieToken = getCookie(event, 'auth_token'); // Use h3's getCookie
  if (cookieToken) {
    token = cookieToken;
  } else {
    // 2. If no cookie, try reading the Authorization header
    const authHeader = getHeader(event, 'authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  if (!token) {
    return null;
  }

  try {
    return verifyToken(token);
  } catch (error) {
    // Error is already logged within verifyToken
    return null;
  }
};


// Check if user is authenticated
export const isAuthenticated = (event: H3Event): boolean => {
  const user = getUserFromEvent(event);
  return !!user;
};

// Check if user is admin (requires 'role' in UserPayload)
// export const isAdmin = (event: H3Event): boolean => {
//   const user = getUserFromEvent(event);
//   return user?.role === 'admin';
// };
