import { defineEventHandler, readBody } from 'h3';
import { db } from '~/server/db';
import { playlists } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { getUserFromEvent } from '~/server/utils/auth';
import { sql } from 'drizzle-orm';

interface CreatePlaylistBody {
  name: string;
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const body = await readBody<CreatePlaylistBody>(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  if (!body.name?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Playlist name is required',
    });
  }

  try {
    // Check if a playlist with the same name already exists for this user
    const existingPlaylist = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, user.userId),
          eq(playlists.name, body.name.trim())
        )
      )
      .get();

    if (existingPlaylist) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A playlist with this name already exists',
      });
    }

    const newPlaylist = {
      playlistId: `${uuidv7()}`,
      userId: user.userId,
      name: body.name.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.insert(playlists).values(newPlaylist);

    return newPlaylist;
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error creating playlist:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create playlist',
    });
  }
});
