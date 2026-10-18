import { defineEventHandler, getQuery } from 'h3';
import { tagTrack } from '../../services/intelligence/engine';
import { withIntelligence } from '../../services/intelligence/http';
import { IntelligenceError } from '../../services/intelligence/types';

export default defineEventHandler(event => withIntelligence(event, (userId, options) => {
  const trackId = getQuery(event).trackId;
  if (typeof trackId !== 'string' || !trackId || trackId.length > 200) throw new IntelligenceError('A track ID is required.', 400);
  return tagTrack(userId, trackId, options);
}));
