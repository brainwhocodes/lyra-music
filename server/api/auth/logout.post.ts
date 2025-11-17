import { clearToken } from '~/server/utils/auth';

export default defineEventHandler((event) => {
  clearToken(event);
  return {
    success: true,
    message: 'User logged out successfully',
  };
});