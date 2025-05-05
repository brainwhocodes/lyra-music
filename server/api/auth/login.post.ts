import { z } from 'zod'
import { createError, readBody, defineEventHandler, setCookie } from 'h3'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword, generateToken, type UserPayload } from '~/server/utils/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
})

export default defineEventHandler(async (event) => {
  // Validate input
  const body = await readBody(event)
  const result = loginSchema.safeParse(body)

  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid input'
    })
  }

  const { email, password } = result.data

  // Find user by email
  const user = await db.select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  // Verify password using the utility function
  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  // Define payload for the token
  const payload: UserPayload = {
    userId: user.id,
    email: user.email
  };

  // Generate JWT token using the utility function
  const token = generateToken(payload);

  // Set the token in an HttpOnly cookie
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    sameSite: 'lax', // Adjust as needed (lax or strict)
    maxAge: 60 * 60 * 24, // 24 hours in seconds
    path: '/', // Cookie available for all paths
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt
    }
  }
})
