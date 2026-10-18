import { defineEventHandler, getQuery } from 'h3';
import { recommendLibrary } from '../../services/intelligence/engine';
import { queryLimit, withIntelligence } from '../../services/intelligence/http';

export default defineEventHandler(event => withIntelligence(event, (userId, options) => recommendLibrary(userId, queryLimit(getQuery(event).limit), options)));
