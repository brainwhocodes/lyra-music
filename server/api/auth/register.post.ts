import { defineEventHandler, readBody, createError, setCookie } from 'h3';
import { z } from 'zod';
import { v7 as uuidv7 } from 'uuid';
import { db } from '~/server/db';
import { users } from '~/server/db/schema';
import { hashPassword, generateToken } from '~/server/utils/auth';
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME, getAuthCookieOptions } from '~/server/utils/auth-cookie';
import { eq } from 'drizzle-orm';

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long.'),
  name: z.string().trim().min(1, 'Name is required.'),
  accessCode: z.string().trim().min(1, 'Access code is required.'),
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  try {
    // Validate request body
    const rawBody = await readBody(event);
    const parsedBody = registerSchema.safeParse(rawBody);
    if (!parsedBody.success) {
      throw createError({
        statusCode: 400,
        message: 'Invalid registration payload.',
        data: parsedBody.error.flatten(),
      });
    }

    const { email, password, name, accessCode } = parsedBody.data;

    if (accessCode !== config.secretAccessCode && process.env.NODE_ENV !== 'development') {
      throw createError({
        statusCode: 401,
        message: 'Invalid access code'
      });
    }

    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).get();
    if (existingUser) {
      throw createError({
        statusCode: 400,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    const [user] = await db.insert(users).values({
      userId: uuidv7(),
      email,
      passwordHash: hashedPassword,
      name,
      verified: 0,
      loginAttempts: 0,
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    // Generate JWT token
    const token = generateToken({ userId: user.userId, name, email });
    setCookie(event, AUTH_COOKIE_NAME, token, getAuthCookieOptions(event))
  
    // Return user data (without password)
    return {
      expiresAt: new Date(Date.now() + AUTH_COOKIE_MAX_AGE_SECONDS * 1000).toISOString(),
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Server error during registration'
    });
  }
});
