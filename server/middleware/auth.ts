import type { H3Event } from 'h3'
import { type UserPayload, getUserFromEvent } from '~/server/utils/auth'

// Augment the H3EventContext interface to include the user property
declare module 'h3' {
  interface H3EventContext {
    user?: UserPayload
  }
}

export default defineEventHandler(async (event: H3Event) => {
  const user = getUserFromEvent(event);

  if (user) {
    event.context.user = user;
  } else {
    event.context.user = undefined;
  }
})
