// Each isolated Vitest suite gets a fresh DB, never the developer's library.
process.env.DATABASE_URL = ':memory:';
process.env.NODE_ENV = 'test';
