import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { db } from '~/server/db'
import { tracks, albums, artists, artistsTracks } from '~/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { getUserFromEvent } from '~/server/utils/auth'
import { splitArtistString } from '~/server/utils/artist-utils'
import { dbOperations } from '~/server/utils/scanner/db-operations'
import { v7 as uuidv7 } from 'uuid'

interface TrackUpdateBody {
  title?: string
  artistName?: string
  albumTitle?: string
  trackNumber?: number | null
  diskNumber?: number | null
  genre?: string | null
  year?: number | null
  explicit?: boolean
}

export default defineEventHandler(async (event) => {
  const trackId = getRouterParam(event, 'trackId')
  if (!trackId) {
    throw createError({ statusCode: 400, statusMessage: 'Track ID is required' })
  }

  const user = await getUserFromEvent(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<TrackUpdateBody>(event)

  const existingTrack = await db
    .select({
      trackId: tracks.trackId,
      albumId: tracks.albumId,
      userId: albums.userId
    })
    .from(tracks)
    .leftJoin(albums, eq(tracks.albumId, albums.albumId))
    .where(eq(tracks.trackId, trackId))
    .get()

  if (!existingTrack) {
    throw createError({ statusCode: 404, statusMessage: 'Track not found' })
  }

  if (existingTrack.userId !== user.userId) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  let albumId = existingTrack.albumId
  if (body.albumTitle !== undefined) {
    const trimmedTitle = body.albumTitle.trim()
    const album = await db
      .select({ albumId: albums.albumId })
      .from(albums)
      .where(and(eq(albums.title, trimmedTitle), eq(albums.userId, user.userId)))
      .get()

    if (album) {
      albumId = album.albumId
    } else {
      const newAlbumId = uuidv7()
      const [newAlbum] = await db
        .insert(albums)
        .values({
          albumId: newAlbumId,
          title: trimmedTitle,
          userId: user.userId,
          processedStatus: 0
        })
        .returning()
      albumId = newAlbum.albumId
    }
  }

  const updateData: any = {}
  if (body.title !== undefined) updateData.title = body.title
  if (body.trackNumber !== undefined) updateData.trackNumber = body.trackNumber
  if (body.diskNumber !== undefined) updateData.diskNumber = body.diskNumber
  if (body.genre !== undefined) updateData.genre = body.genre
  if (body.year !== undefined) updateData.year = body.year
  if (body.explicit !== undefined) updateData.explicit = body.explicit
  if (albumId !== existingTrack.albumId) updateData.albumId = albumId

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date().toISOString()
    await db.update(tracks).set(updateData).where(eq(tracks.trackId, trackId))
  }

  if (body.artistName !== undefined) {
    const names = splitArtistString(body.artistName)
    if (names.length > 0) {
      const artistLinks: { artistId: string; role: string | null; isPrimaryArtist: number }[] = []
      for (const [idx, name] of names.entries()) {
        const artist = await dbOperations.findOrCreateArtist({
          artistName: name,
          userId: user.userId,
          skipRemoteImageFetch: true
        })
        if (artist) {
          artistLinks.push({
            artistId: artist.artistId,
            role: idx === 0 ? 'main' : null,
            isPrimaryArtist: idx === 0 ? 1 : 0
          })
        }
      }
      await db.delete(artistsTracks).where(eq(artistsTracks.trackId, trackId))
      if (artistLinks.length > 0) {
        await db.insert(artistsTracks).values(
          artistLinks.map(link => ({
            artistsTracksId: uuidv7(),
            artistId: link.artistId,
            trackId,
            role: link.role,
            isPrimaryArtist: link.isPrimaryArtist
          }))
        )
      }
    }
  }

  const updatedTrack = await db
    .select({
      trackId: tracks.trackId,
      title: tracks.title,
      albumId: tracks.albumId,
      trackNumber: tracks.trackNumber,
      duration: tracks.duration,
      filePath: tracks.filePath,
      genre: tracks.genre,
      year: tracks.year,
      diskNumber: tracks.diskNumber,
      explicit: tracks.explicit,
      createdAt: tracks.createdAt,
      updatedAt: tracks.updatedAt,
      albumTitle: albums.title
    })
    .from(tracks)
    .leftJoin(albums, eq(tracks.albumId, albums.albumId))
    .where(eq(tracks.trackId, trackId))
    .get()

  const artistRows = await db
    .select({
      artistId: artists.artistId,
      name: artists.name,
      roleDb: artistsTracks.role,
      isPrimaryDb: artistsTracks.isPrimaryArtist
    })
    .from(artistsTracks)
    .innerJoin(artists, eq(artistsTracks.artistId, artists.artistId))
    .where(eq(artistsTracks.trackId, trackId))
    .all()

  const artistsFinal = artistRows.map(row => ({
    artistId: row.artistId!,
    name: row.name!,
    role: row.roleDb || undefined,
    isPrimaryArtist: row.isPrimaryDb === 1
  }))

  return {
    ...updatedTrack,
    artists: artistsFinal
  }
})
