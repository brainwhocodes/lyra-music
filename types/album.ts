// Define the expected structure from the API endpoint
export interface Album {
    albumId: string;
    title: string;
    year: number | null;
    coverPath: string | null;
    artistId: string;
    artistName: string;
    tracks: Track[];
}