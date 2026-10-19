import { defineEventHandler, getQuery } from 'h3';
import { readDailyRecommendations } from '../../services/intelligence/recommendations';
import { queryLimit, withIntelligence } from '../../services/intelligence/http';

export default defineEventHandler(event => withIntelligence(event, (userId, options) => readDailyRecommendations(userId, queryLimit(getQuery(event).limit), options)));
