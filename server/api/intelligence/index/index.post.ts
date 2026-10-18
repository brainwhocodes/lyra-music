import { defineEventHandler, readBody } from 'h3';
import { indexLibrary } from '../../../services/intelligence/engine';
import { queryLimit, withIntelligence } from '../../../services/intelligence/http';
import { IntelligenceError } from '../../../services/intelligence/types';

export default defineEventHandler(event => withIntelligence(event, async (userId, options) => {
  const body = await readBody(event);
  if (body !== undefined && body !== null && (typeof body !== 'object' || Array.isArray(body))) throw new IntelligenceError('Expected a JSON object.', 400);
  return indexLibrary(userId, queryLimit(body?.limit, 16), options);
}));
