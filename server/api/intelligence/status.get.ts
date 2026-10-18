import { defineEventHandler } from 'h3';
import { intelligenceStatus } from '../../services/intelligence/engine';
import { withIntelligence } from '../../services/intelligence/http';

export default defineEventHandler(event => withIntelligence(event, (userId, options) => intelligenceStatus(userId, options)));
