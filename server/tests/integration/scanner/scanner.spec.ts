// server/tests/integration/scanner/scanner.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db } from '~/server/db'; // Adjusted path assuming Vitest runs from root
import { scanDirectory } from '~/server/services/scanner'; // Adjusted path
import { artists, albums, tracks } from '~/server/db/schema'; // Adjusted path
import { eq } from 'drizzle-orm'; // Import eq function

// Define paths relative to the project root
const TEST_DB_PATH = path.join(process.cwd(), 'server', 'tests', 'integration', 'scanner', 'test-db.sqlite');
const TEST_LIB_PATH = path.join(process.cwd(), 'server', 'tests', 'integration', 'scanner', 'test-library');
const COVERS_DIR_ABSOLUTE = path.join(process.cwd(), 'public', 'images', 'covers'); // Path from scanner.ts

// Helper to delete database and potentially WAL files
async function cleanDatabase() {
    try {
        await fs.unlink(TEST_DB_PATH);
        console.log('Test database deleted.');
    } catch (error: any) {
        if (error.code !== 'ENOENT') { // Ignore error if file doesn't exist
            console.error('Error deleting test database:', error);
        }
    }
    // Also delete WAL/SHM files if they exist
    try { await fs.unlink(TEST_DB_PATH + '-wal'); } catch (e: any) { if (e.code !== 'ENOENT') console.error('Error deleting WAL file:', e); }
    try { await fs.unlink(TEST_DB_PATH + '-shm'); } catch (e: any) { if (e.code !== 'ENOENT') console.error('Error deleting SHM file:', e); }
}

// Helper to clean test library directories (can be expanded later)
async function cleanTestLibrary() {
    // For now, just ensure the base directory exists.
    // We might add logic later to remove files within the test scenario folders.
    try {
        await fs.rm(TEST_LIB_PATH, { recursive: true, force: true });
        await fs.mkdir(TEST_LIB_PATH, { recursive: true });
        // Recreate specific sub-folders if needed by tests
        await fs.mkdir(path.join(TEST_LIB_PATH, 'album-with-external-cover'), { recursive: true });
        await fs.mkdir(path.join(TEST_LIB_PATH, 'album-with-embedded-cover'), { recursive: true });
        await fs.mkdir(path.join(TEST_LIB_PATH, 'album-no-cover'), { recursive: true });
        await fs.mkdir(path.join(TEST_LIB_PATH, 'album-multiple-covers'), { recursive: true });
        await fs.mkdir(path.join(TEST_LIB_PATH, 'root-file-test'), { recursive: true });
        console.log('Test library directory cleaned and recreated.');
    } catch (error) {
        console.error('Error cleaning test library:', error);
    }
}

// Helper to clean covers directory
async function cleanCoversDirectory() {
     try {
        // Read all files/subdirs in the covers directory
        const items = await fs.readdir(COVERS_DIR_ABSOLUTE);
        for (const item of items) {
            // Only delete files (assuming covers are files) - adjust if needed
            const itemPath = path.join(COVERS_DIR_ABSOLUTE, item);
            const stat = await fs.stat(itemPath);
            if (stat.isFile()) {
                await fs.unlink(itemPath);
            }
            // Add logic for subdirectories if necessary
        }
        console.log('Covers directory cleaned.');
    } catch (error: any) {
         if (error.code !== 'ENOENT') { // Ignore error if dir doesn't exist
             console.error('Error cleaning covers directory:', error);
         }
    }
}


describe('Scanner Service Integration Tests', () => {

    beforeEach(async () => {
        // Clean up before each test
        await cleanDatabase();
        await cleanTestLibrary();
        await cleanCoversDirectory();
        // We might need to re-initialize the DB connection or run migrations here
        // For now, relying on the db index re-creating the file
    });

    afterEach(async () => {
        // Optional: Clean up after each test if needed
    });

    it('should return zero counts when scanning an empty directory', async () => {
        const result = await scanDirectory(TEST_LIB_PATH);
        expect(result).toEqual({ scanned: 0, added: 0, errors: 0 });

        // Verify database is empty
        const allArtists = await db.select().from(artists);
        const allAlbums = await db.select().from(albums);
        const allTracks = await db.select().from(tracks);
        expect(allArtists.length).toBe(0);
        expect(allAlbums.length).toBe(0);
        expect(allTracks.length).toBe(0);
    });

    // --- Test Case: External Cover --- //
    it('should process an album with an external cover image', async () => {
        const albumDir = path.join(TEST_LIB_PATH, 'album-with-external-cover');
        const coverSourcePath = path.join(albumDir, 'cover.jpg'); // Assuming cover.jpg exists
        const trackSourcePath = path.join(albumDir, 'track1.mp3'); // Assuming track1.mp3 exists

        // **Important**: You need to place actual files with appropriate metadata here!
        // For this test structure, we assume files exist. A more robust setup
        // might involve creating dummy files programmatically in beforeEach.
        // Example: await fs.writeFile(coverSourcePath, Buffer.from('dummy image data'));
        // Example: await fs.writeFile(trackSourcePath, Buffer.from('dummy mp3 data with tags'));
        // Ensure the directory exists (cleanTestLibrary should handle this)
        // await fs.mkdir(albumDir, { recursive: true }); 

        // Assumptions about metadata in track1.mp3:
        const expectedArtist = 'Test Artist External';
        const expectedAlbum = 'External Cover Test Album';
        const expectedTrack = 'Track 1 External';

        // --- Create dummy files for testing if they don't exist --- 
        // (Replace with actual file placement by the user)
        try {
             // Create a tiny dummy jpg
            const dummyImageData = Buffer.from([
                0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, // Minimal JPEG header
                0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03, // DQT
                0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06, 
                0x06, 0x05, 0x06, 0x09, 0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a, 0x0c, 0x0f, 0x0c, 0x0a, 
                0x0b, 0x0e, 0x0b, 0x09, 0x09, 0x0d, 0x11, 0x0d, 0x0e, 0x0f, 0x10, 0x10, 0x11, 0x10, 0x0a, 0x0c, 
                0x12, 0x13, 0x12, 0x10, 0x13, 0x0f, 0x10, 0x10, 0x10, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, // SOF0 (1x1 pixel)
                0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, // DHT
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, // SOS
                0x01, 0x00, 0x00, 0x3f, 0x00, 0xd2, 0xcf, 0x20, 0xff, 0xd9 // EOI
            ]);
            await fs.writeFile(coverSourcePath, dummyImageData);

            // Create a dummy mp3 file placeholder (scanner needs a real file for metadata)
            // NOTE: This test WILL FAIL without a real MP3 with actual tags.
            // The user needs to provide a real file with tags:
            // Artist: Test Artist External, Album: External Cover Test Album, Title: Track 1 External
            await fs.writeFile(trackSourcePath, Buffer.from('dummy mp3 data - needs replacement')); 
            console.log(`Created dummy files in ${albumDir} for test setup.`);
        } catch (err) {
            console.warn(`Could not create dummy files for test (this is expected if user provided real files): ${err}`);
        }
        // --- End dummy file creation ---

        const result = await scanDirectory(TEST_LIB_PATH);

        // Assert counts (assuming 1 track file)
        // NOTE: If the dummy track file fails metadata extraction, counts might differ.
        expect(result.scanned).toBe(1);
        expect(result.added).toBe(1);
        expect(result.errors).toBe(0);

        // Verify database state
        const artistsList = await db.select().from(artists).where(eq(artists.name, expectedArtist));
        expect(artistsList.length).toBe(1);
        const artistId = artistsList[0].id;

        const albumsList = await db.select().from(albums).where(eq(albums.title, expectedAlbum));
        expect(albumsList.length).toBe(1);
        const album = albumsList[0];
        expect(album.artistId).toBe(artistId);
        expect(album.artPath).toBeDefined(); // Check that artPath is set
        expect(album.artPath).not.toBeNull();

        const tracksList = await db.select().from(tracks).where(eq(tracks.title, expectedTrack));
        expect(tracksList.length).toBe(1);
        const track = tracksList[0];
        expect(track.albumId).toBe(album.id);
        expect(track.artistId).toBe(artistId);
        expect(track.filePath).toBe(trackSourcePath); // Check file path is stored

        // Verify cover art was copied
        const savedCoverFilename = album.artPath?.split('/').pop(); // Get filename from relative path
        expect(savedCoverFilename).toBeDefined();
        const savedCoverPath = path.join(COVERS_DIR_ABSOLUTE, savedCoverFilename!);
        try {
            await fs.access(savedCoverPath, fs.constants.F_OK);
            // File exists - test passed this part
        } catch (e) {
            throw new Error(`Saved cover art file not found at ${savedCoverPath}`);
        }
    });

    // --- Test Case: Embedded Cover --- //
    it('should process an album with embedded cover art when no external cover exists', async () => {
        const albumDir = path.join(TEST_LIB_PATH, 'album-with-embedded-cover');
        const trackSourcePath = path.join(albumDir, 'track1-embedded.mp3'); // Assuming this track has embedded art

        // **Important**: You need to place an actual audio file here with:
        // - Metadata: Artist='Test Artist Embedded', Album='Embedded Cover Test Album', Title='Track 1 Embedded'
        // - Valid embedded cover art data.
        // - NO external cover files (e.g., cover.jpg) in this directory.

        // Assumptions about metadata:
        const expectedArtist = 'Test Artist Embedded';
        const expectedAlbum = 'Embedded Cover Test Album';
        const expectedTrack = 'Track 1 Embedded';

        // --- Create dummy file placeholder --- 
        // NOTE: Test WILL FAIL without a real MP3 with embedded tags/art.
        try {
            await fs.writeFile(trackSourcePath, Buffer.from('dummy mp3 data - needs replacement with embedded art')); 
            console.log(`Created dummy file in ${albumDir} for embedded art test setup.`);
        } catch (err) {
            console.warn(`Could not create dummy file for embedded art test: ${err}`);
        }
        // --- End dummy file creation ---

        const result = await scanDirectory(TEST_LIB_PATH);

        // Assert counts (assuming 1 track file with valid metadata/art)
        expect(result.scanned).toBe(1);
        expect(result.added).toBe(1);
        expect(result.errors).toBe(0);

        // Verify database state
        const artistsList = await db.select().from(artists).where(eq(artists.name, expectedArtist));
        expect(artistsList.length).toBe(1);
        const artistId = artistsList[0].id;

        const albumsList = await db.select().from(albums).where(eq(albums.title, expectedAlbum));
        expect(albumsList.length).toBe(1);
        const album = albumsList[0];
        expect(album.artistId).toBe(artistId);
        expect(album.artPath).toBeDefined(); // Check artPath is set from embedded
        expect(album.artPath).not.toBeNull();

        const tracksList = await db.select().from(tracks).where(eq(tracks.title, expectedTrack));
        expect(tracksList.length).toBe(1);
        const track = tracksList[0];
        expect(track.albumId).toBe(album.id);
        expect(track.artistId).toBe(artistId);
        expect(track.filePath).toBe(trackSourcePath); 

        // Verify embedded cover art was extracted and saved
        const savedCoverFilename = album.artPath?.split('/').pop();
        expect(savedCoverFilename).toBeDefined();
        const savedCoverPath = path.join(COVERS_DIR_ABSOLUTE, savedCoverFilename!);
        try {
            await fs.access(savedCoverPath, fs.constants.F_OK);
        } catch (e) {
            throw new Error(`Saved embedded cover art file not found at ${savedCoverPath}`);
        }
    });

    // --- Test Case: No Cover --- //
    it('should correctly handle an album with no cover art', async () => {
        const albumDir = path.join(TEST_LIB_PATH, 'album-no-cover');
        const trackSourcePath = path.join(albumDir, 'track1-no-cover.mp3'); // Assuming no embedded art

        // **Important**: You need to place an actual audio file here with:
        // - Metadata: Artist='Test Artist No Cover', Album='No Cover Test Album', Title='Track 1 No Cover'
        // - NO embedded cover art.
        // - NO external cover files (e.g., cover.jpg) in this directory.

        // Assumptions about metadata:
        const expectedArtist = 'Test Artist No Cover';
        const expectedAlbum = 'No Cover Test Album';
        const expectedTrack = 'Track 1 No Cover';

        // --- Create dummy file placeholder --- 
        // NOTE: Test WILL FAIL without a real MP3 with correct tags and NO embedded art.
        try {
            await fs.writeFile(trackSourcePath, Buffer.from('dummy mp3 data - needs replacement, no embedded art')); 
            console.log(`Created dummy file in ${albumDir} for no cover test setup.`);
        } catch (err) {
            console.warn(`Could not create dummy file for no cover test: ${err}`);
        }
        // --- End dummy file creation ---

        // Get list of files in covers dir before scan
        let coversBefore: string[] = [];
        try {
            coversBefore = await fs.readdir(COVERS_DIR_ABSOLUTE);
        } catch (e: any) { if (e.code !== 'ENOENT') throw e; }

        const result = await scanDirectory(TEST_LIB_PATH);

        // Assert counts (assuming 1 track file with valid metadata)
        expect(result.scanned).toBe(1);
        expect(result.added).toBe(1);
        expect(result.errors).toBe(0);

        // Verify database state
        const artistsList = await db.select().from(artists).where(eq(artists.name, expectedArtist));
        expect(artistsList.length).toBe(1);
        const artistId = artistsList[0].id;

        const albumsList = await db.select().from(albums).where(eq(albums.title, expectedAlbum));
        expect(albumsList.length).toBe(1);
        const album = albumsList[0];
        expect(album.artistId).toBe(artistId);
        expect(album.artPath).toBeNull(); // <<< Crucial check: artPath should be null

        const tracksList = await db.select().from(tracks).where(eq(tracks.title, expectedTrack));
        expect(tracksList.length).toBe(1);
        const track = tracksList[0];
        expect(track.albumId).toBe(album.id);
        expect(track.artistId).toBe(artistId);
        expect(track.filePath).toBe(trackSourcePath); 

        // Verify no cover art was added
        let coversAfter: string[] = [];
        try {
            coversAfter = await fs.readdir(COVERS_DIR_ABSOLUTE);
        } catch (e: any) { if (e.code !== 'ENOENT') throw e; }
        expect(coversAfter.length).toBe(coversBefore.length); // No new files added
    });

    // --- Test Case: Ignore Root Files --- //
    it('should ignore audio files placed directly in the root scan directory', async () => {
        const rootTrackPath = path.join(TEST_LIB_PATH, 'root-track.mp3');

        // Create a dummy audio file directly in the test library root
        try {
            await fs.writeFile(rootTrackPath, Buffer.from('dummy mp3 data in root')); 
            console.log(`Created dummy file in ${TEST_LIB_PATH} for root file test setup.`);
        } catch (err) {
            console.warn(`Could not create dummy file for root file test: ${err}`);
        }

        const result = await scanDirectory(TEST_LIB_PATH);

        // Assert counts - nothing should be scanned or added as root files are ignored
        expect(result.scanned).toBe(0);
        expect(result.added).toBe(0);
        expect(result.errors).toBe(0);

        // Verify database is still empty
        const allArtists = await db.select().from(artists);
        const allAlbums = await db.select().from(albums);
        const allTracks = await db.select().from(tracks);
        expect(allArtists.length).toBe(0);
        expect(allAlbums.length).toBe(0);
        expect(allTracks.length).toBe(0);

        // Clean up the dummy file
        try { await fs.unlink(rootTrackPath); } catch (e) { /* ignore */ }
    });

    // --- Test Case: Multiple External Covers --- //
    it('should select only one cover when multiple external covers exist', async () => {
        const albumDir = path.join(TEST_LIB_PATH, 'album-multiple-covers');
        const trackSourcePath = path.join(albumDir, 'track1-multi.mp3');
        const coverSourcePath1 = path.join(albumDir, 'cover.jpg'); // Assume this exists
        const coverSourcePath2 = path.join(albumDir, 'folder.png'); // Assume this also exists

        // **Important**: You need:
        // - An audio file with tags: Artist='Test Artist Multi', Album='Multi Cover Test Album', Title='Track 1 Multi'
        // - At least two valid image files matching naming conventions (e.g., cover.jpg, folder.png).

        // Assumptions about metadata:
        const expectedArtist = 'Test Artist Multi';
        const expectedAlbum = 'Multi Cover Test Album';
        const expectedTrack = 'Track 1 Multi';

        // --- Create dummy files --- 
        // NOTE: Test WILL FAIL without real files.
        try {
             // Dummy JPG (reuse from previous test)
             const dummyImageData = Buffer.from([
                0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
                0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x02, 0x02, 0x02, 0x03,
                0x02, 0x02, 0x02, 0x03, 0x03, 0x03, 0x03, 0x04, 0x06, 0x04, 0x04, 0x04, 0x04, 0x04, 0x08, 0x06,
                0x06, 0x05, 0x06, 0x09, 0x08, 0x0a, 0x0a, 0x09, 0x08, 0x09, 0x09, 0x0a, 0x0c, 0x0f, 0x0c, 0x0a,
                0x0b, 0x0e, 0x0b, 0x09, 0x09, 0x0d, 0x11, 0x0d, 0x0e, 0x0f, 0x10, 0x10, 0x11, 0x10, 0x0a, 0x0c,
                0x12, 0x13, 0x12, 0x10, 0x13, 0x0f, 0x10, 0x10, 0x10, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
                0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01,
                0x01, 0x00, 0x00, 0x3f, 0x00, 0xd2, 0xcf, 0x20, 0xff, 0xd9
             ]);
             // Dummy PNG (Minimal)
             const dummyPngData = Buffer.from([
                 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
                 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length and type
                 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // Width 1, Height 1
                 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, // Bit depth, color type, etc.
                 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, // IDAT chunk length and type
                 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, // Image data
                 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82 // IEND chunk
             ]);
            await fs.writeFile(coverSourcePath1, dummyImageData);
            await fs.writeFile(coverSourcePath2, dummyPngData);
            await fs.writeFile(trackSourcePath, Buffer.from('dummy mp3 data - needs replacement')); 
            console.log(`Created dummy files in ${albumDir} for multiple cover test setup.`);
        } catch (err) {
            console.warn(`Could not create dummy files for multiple cover test: ${err}`);
        }
        // --- End dummy file creation ---

        // Get count of files in covers dir before scan
        let coversBeforeCount = 0;
        try {
            coversBeforeCount = (await fs.readdir(COVERS_DIR_ABSOLUTE)).length;
        } catch (e: any) { if (e.code !== 'ENOENT') throw e; }

        const result = await scanDirectory(TEST_LIB_PATH);

        // Assert counts (assuming 1 track file)
        expect(result.scanned).toBe(1);
        expect(result.added).toBe(1);
        expect(result.errors).toBe(0);

        // Verify database state
        const artistsList = await db.select().from(artists).where(eq(artists.name, expectedArtist));
        expect(artistsList.length).toBe(1);
        const artistId = artistsList[0].id;

        const albumsList = await db.select().from(albums).where(eq(albums.title, expectedAlbum));
        expect(albumsList.length).toBe(1);
        const album = albumsList[0];
        expect(album.artistId).toBe(artistId);
        expect(album.artPath).toBeDefined(); // Check that artPath is set
        expect(album.artPath).not.toBeNull();

        const tracksList = await db.select().from(tracks).where(eq(tracks.title, expectedTrack));
        expect(tracksList.length).toBe(1);
        const track = tracksList[0];
        expect(track.albumId).toBe(album.id);
        expect(track.artistId).toBe(artistId);
        expect(track.filePath).toBe(trackSourcePath); 

        // Verify only ONE cover art was copied
        let coversAfterCount = 0;
        try {
             const savedCoverFilename = album.artPath?.split('/').pop();
             expect(savedCoverFilename).toBeDefined();
             const savedCoverPath = path.join(COVERS_DIR_ABSOLUTE, savedCoverFilename!);
             await fs.access(savedCoverPath, fs.constants.F_OK); // Ensure the ONE file exists
             coversAfterCount = (await fs.readdir(COVERS_DIR_ABSOLUTE)).length;
        } catch (e: any) {
            if (e.code === 'ENOENT') {
                 throw new Error(`Saved cover art file for album ${expectedAlbum} not found.`);
            } else {
                throw e; // Re-throw other errors
            }
        }
        expect(coversAfterCount).toBe(coversBeforeCount + 1); // Exactly one new file
    });

});
