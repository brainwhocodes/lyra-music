import { z } from 'zod'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { hashPassword } from '~/server/utils/auth'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100)
})

type RegisterRequest = z.infer<typeof registerSchema>

export default defineEventHandler(async (event) => {
  // Parse and validate request body
  const body = await readBody<RegisterRequest>(event)
  const result = registerSchema.safeParse(body)
  
  if (!result.success) {
    throw createError({
      statusCode: 400,
      message: 'Invalid input',
      data: result.error.issues
    })
  }

  const { email, password } = result.data

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get()

    if (existingUser) {
      throw createError({
        statusCode: 409,
        message: 'Email already registered'
      })
    }

    // Hash password with scrypt
    const passwordHash = await hashPassword(password)

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash
      })
      .returning()

    return {
      id: newUser.id,
      email: newUser.email,
      createdAt: newUser.createdAt
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    console.error('Registration error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to create user'
    })
  }
})
