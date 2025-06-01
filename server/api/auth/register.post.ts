import { defineEventHandler, readBody, createError, setCookie } from 'h3';
import { v7 as uuidv7 } from 'uuid';
import { db } from '~/server/db';
import { users } from '~/server/db/schema';
import { hashPassword, generateToken } from '~/server/utils/auth';
import { eq, sql } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    // Get request body
    const { email, password, name } = await readBody(event);

    // Validate input
    if (!email || !password || !name) {
      throw createError({
        statusCode: 400,
        message: 'Email, password, and name are required'
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

    // Create user
    const now = Date.now();
    
    const [user] = await db.insert(users).values({
      userId: uuidv7(),
      email,
      passwordHash: hashedPassword,
      name,
      createdAt: sql`CURRENT_TIMESTAMP`,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    }).returning();

    // Generate JWT token
    const token = generateToken({ userId: user.userId, name, email });
    setCookie(event, 'auth_token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
  
    // Return user data (without password)
    return {
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString(),
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      message: error.message || 'Server error during registration'
    });
  }
});
