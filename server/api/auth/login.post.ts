import { z } from 'zod'
import { createError, readBody, defineEventHandler, setCookie } from 'h3'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword, generateToken } from '~/server/utils/auth';
import { AUTH_COOKIE_MAX_AGE_SECONDS, AUTH_COOKIE_NAME, getAuthCookieOptions } from '~/server/utils/auth-cookie';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long.')
})

export default defineEventHandler(async (event) => {
  // Validate input
  const rawBody = await readBody(event)
  const parsedBody = loginSchema.safeParse(rawBody)

  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid login payload.',
      data: parsedBody.error.flatten()
    })
  }

  const { email, password } = parsedBody.data
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
  const verification = await verifyPassword(password, user.passwordHash);

  if (!verification.success) {
    throw createError({
      statusCode: 401,
      message: 'Invalid email or password'
    })
  }

  db.update(users)
    .set({
      loginAttempts: 0,
      lastLoginAt: new Date().toISOString(),
    })
    .where(eq(users.userId, user.userId))
    .run()

  // Generate JWT token using the utility function
  const token = generateToken({ userId: user.userId, name: user.name, email: user.email });

  // Set cookie
  setCookie(event, AUTH_COOKIE_NAME, token, getAuthCookieOptions(event))

  return {
    expiresAt: new Date(Date.now() + AUTH_COOKIE_MAX_AGE_SECONDS * 1000).toISOString(),
  }
})
