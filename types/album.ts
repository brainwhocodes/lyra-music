// Define the expected structure from the API endpoint
export interface Album {
    id: number;
    title: string;
    year: number | null;
    coverPath: string | null;
    artistId: number;
    artistName: string;
    tracks: Track[];
}