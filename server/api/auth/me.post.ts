import { z } from 'zod'
import { createError, readBody, defineEventHandler, setCookie } from 'h3'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { verifyPassword, generateToken } from '~/server/utils/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
})

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event)

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required.'
    })
  }

  return user
})
