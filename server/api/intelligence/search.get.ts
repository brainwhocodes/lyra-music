import { defineEventHandler, getQuery } from 'h3';
import { searchLibrary } from '../../services/intelligence/engine';
import { queryLimit, withIntelligence } from '../../services/intelligence/http';
import { IntelligenceError } from '../../services/intelligence/types';

export default defineEventHandler(event => withIntelligence(event, (userId, options) => {
  const query = getQuery(event);
  if (typeof query.q !== 'string') throw new IntelligenceError('A search query is required.', 400);
  return searchLibrary(userId, query.q, queryLimit(query.limit), options);
}));
