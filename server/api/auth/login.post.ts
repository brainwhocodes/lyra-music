import { z } from 'zod'
import { createError, readBody, defineEventHandler, setCookie } from 'h3'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { eq, sql } from 'drizzle-orm'
import { verifyPassword, generateToken } from '~/server/utils/auth';

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
  const user = db.select()
    .from(users)
    .where(eq(users.email, email))
    .get()

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  db.update(users)
    .set({
      loginAttempts: user.loginAttempts + 1,
    })
    .where(eq(users.userId, user.userId))
    .run()

  // Verify password using the utility function
  const isPasswordValid = await verifyPassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  db.update(users)
    .set({
      loginAttempts: 0,
      lastLoginAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(users.userId, user.userId))
    .run()

  // Generate JWT token using the utility function
  const token = generateToken({ userId: user.userId, name: user.name, email: user.email });

  // Set cookie
  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  })

  return {
    token,
    expiresAt: new Date(Date.now() + 60 * 60 * 24 * 1000).toISOString(), // 7 days
  }
})
