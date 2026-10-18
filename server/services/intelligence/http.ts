import { createError, isError, type H3Event } from 'h3';
import { getUserFromEvent } from '../../utils/auth';
import { IntelligenceError, type EmbeddingOptions } from './types';

export async function withIntelligence<T>(event: H3Event, action: (userId: string, options: EmbeddingOptions) => T | Promise<T>): Promise<T> {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  try { return await action(user.userId, useRuntimeConfig(event)); }
  catch (error) {
    if (isError(error) && error.statusCode >= 400 && error.statusCode < 500) throw error;
    if (error instanceof IntelligenceError) throw createError({ statusCode: error.statusCode, statusMessage: error.message });
    console.error('Local music intelligence failed:', error instanceof Error ? error.name : 'Unknown error');
    throw createError({ statusCode: 500, statusMessage: 'Local music intelligence failed.' });
  }
}

export function queryLimit(value: unknown, fallback = 20): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' && typeof value !== 'number') throw new IntelligenceError('Invalid result limit.', 400);
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new IntelligenceError('Limit must be an integer from 1 to 50.', 400);
  return limit;
}
