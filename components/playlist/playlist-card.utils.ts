export const formatPlaylistTrackCount = (count: number | undefined): string => {
  if (count === undefined) return '0 tracks'
  return count === 1 ? '1 track' : `${count} tracks`
}
