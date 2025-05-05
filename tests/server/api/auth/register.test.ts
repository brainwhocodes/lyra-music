import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setup } from '@nuxt/test-utils'
import { db } from '~/server/db'
import { users } from '~/server/db/schema'
import type { Mock } from 'vitest'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { SQLiteSelectBase } from 'drizzle-orm/sqlite-core'

type MockDbResult = {
  get: Mock
  _: any
  [Symbol.toStringTag]: string
  prepare: any
  run: any
}

type MockDb = {
  select: Mock
  insert: Mock
}

vi.mock('~/server/db', () => {
  const mockDb: MockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn(),
          _: {},
          [Symbol.toStringTag]: 'SQLiteSelectBase',
          prepare: vi.fn(),
          run: vi.fn()
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn()
      })
    })
  }
  return { db: mockDb as unknown as BetterSQLite3Database }
})

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register a new user with valid input', async () => {
    const nuxt = await setup({
      server: true
    })

    // Mock DB responses
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      createdAt: new Date()
    }

    const dbSelect = db.select().from(users).where
    const dbInsert = db.insert(users).values

    vi.mocked(dbSelect).mockReturnValueOnce({
      get: vi.fn().mockResolvedValueOnce(null),
      _: {},
      [Symbol.toStringTag]: 'SQLiteSelectBase',
      prepare: vi.fn(),
      run: vi.fn(),
      dialect: 'sqlite',
      hkt: 'SQLiteSelectHKT',
      tableName: 'users',
      resultType: 'sync',
      runResult: null,
      selection: users
    } as any)

    vi.mocked(dbInsert).mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([mockUser])
    })

    // Make request to the API
    const response = await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'securepass123'
      }
    })

    expect(response).toEqual({
      id: mockUser.id,
      email: mockUser.email,
      createdAt: mockUser.createdAt
    })
  })

  it('should reject registration with invalid email', async () => {
    const nuxt = await setup({
      server: true
    })

    await expect($fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'invalid-email',
        password: 'securepass123'
      }
    })).rejects.toThrow('Invalid input')
  })

  it('should reject registration with short password', async () => {
    const nuxt = await setup({
      server: true
    })

    await expect($fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: '123'
      }
    })).rejects.toThrow('Invalid input')
  })

  it('should reject registration for existing email', async () => {
    const nuxt = await setup({
      server: true
    })

    const existingUser = {
      id: 1,
      email: 'existing@example.com',
      createdAt: new Date()
    }

    const mockDb = db as unknown as MockDb
    const dbSelect = mockDb.select().from(users).where

    dbSelect.mockReturnValueOnce({
      get: vi.fn().mockResolvedValueOnce(existingUser),
      _: {},
      [Symbol.toStringTag]: 'SQLiteSelectBase',
      prepare: vi.fn(),
      run: vi.fn()
    })

    await expect($fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'existing@example.com',
        password: 'securepass123'
      }
    })).rejects.toThrow('Email already registered')
  })

  it('should hash the password before storing', async () => {
    const nuxt = await setup({
      server: true
    })

    const mockUser = {
      id: 1,
      email: 'test@example.com',
      createdAt: new Date()
    }

    const dbSelect = db.select().from(users).where
    const dbInsert = db.insert(users).values

    vi.mocked(dbSelect).mockReturnValueOnce({
      get: vi.fn().mockResolvedValueOnce(null),
      _: {},
      [Symbol.toStringTag]: 'SQLiteSelectBase',
      prepare: vi.fn(),
      run: vi.fn(),
      dialect: 'sqlite',
      hkt: 'SQLiteSelectHKT',
      tableName: 'users',
      resultType: 'sync',
      runResult: null,
      selection: users
    } as any)

    vi.mocked(dbInsert).mockReturnValueOnce({
      returning: vi.fn().mockResolvedValueOnce([mockUser])
    })

    await $fetch('/api/auth/register', {
      method: 'POST',
      body: {
        email: 'test@example.com',
        password: 'securepass123'
      }
    })

    // Verify the password was hashed (contains salt:hash format)
    const insertCall = vi.mocked(dbInsert).mock.calls[0][0]
    expect(insertCall.passwordHash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/)
  })
})
