export interface RadioStation {
  channelId: string; userId: string | null; name: string; dynamic: number;
  logoImagePath: string | null; backgroundImagePath: string | null;
  createdAt: string; updatedAt: string;
  radioChannelArtists: { artist: { artistId: string; name: string } }[];
  radioChannelGenres: { genre: { genreId: string; name: string } }[];
}
