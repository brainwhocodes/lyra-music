# Local listener setup

The optional local listener uses the real application and the four user-provided albums. It adds one dedicated account, four albums and 37 tracks without changing existing passwords or copying listening history, lyrics or embeddings from the private test database.

Run the local server against its existing migrated SQLite database first. The verified private-album extraction/import must already exist under `.test-data/private-albums`. Keep that directory available: the local library references its original audio files.

```powershell
node scripts/setup-local-listener.mjs          # read-only plan
node scripts/setup-local-listener.mjs --apply  # backup, actual registration/login, additive metadata
```

The default database comes from `DATABASE_URL` or `.env`, falling back to `./db.sqlite`. The default URL is `http://127.0.0.1:3000`; `LYRA_LOCAL_URL` can select another loopback preview. The script does not migrate or restart the server. Existing account collisions, another owner's audio paths, redirected paths and incomplete prior seeds cause a refusal instead of a reset. A complete repeated setup keeps metadata edits and the existing password.

After `pnpm build`, Windows users can start both the web app and daily recommendation worker with `pnpm local:start:windows` (or `.\scripts\start-local.ps1 -Port 3003`). The script loads the model setup's runtime environment, runs additive database migrations and refuses an occupied port. Keep the terminal running; Ctrl+C ends the web session and its worker. Worker logs remain in ignored `.test-data/local-runtime`. No system service is installed. On other systems, load `.tools/models/runtime-env.sh` and run the web app and `pnpm worker` in separate terminals with the same environment.

Credentials are randomly generated and saved only to ignored `.test-data/local-listener/account.json`. SQLite backups are under its `backups` subdirectory. Login/register verification does not record screenshots, video or traces. Private album covers remain under ignored `uploads`.

Optional real application verification:

```powershell
node scripts/verify-local-listener.mjs --stations
node scripts/verify-local-listener.mjs --models
```

`--stations` creates two stations from actual imported artists through authenticated HTTP requests. It preserves previously created stations and verifies each queue contains real tracks from this account. The supplied albums have no genre relationships, so no genre seeds are invented. These requests do not play music or create listening history.

`--models` requires the server to have been started with the verified local model environment (see `scripts/start-local.ps1`). It uses actual browser controls to index the library, search, display suggested tags and generate lyrics for the private verification candidate. Existing lyrics are preserved; a successful newly generated result is checked through the persistence endpoint, then the index is refreshed to include it. Private screenshots and aggregate reports go under ignored `.test-data/local-listener/verification`. Neither private lyrics nor credentials are printed or written to tracked documentation.

These checks verify runtime behavior and persistence. They do not supply a human reference transcript, a song transcription accuracy score, or a recommendation quality score. Recommendations remain a cold start until genuine listening history exists; the setup does not fabricate plays.

Verified on the local preview on 2026-10-18: actual registration and fresh login, four albums/37 tracks, two artist stations with populated queues, all 37 embeddings indexed at 256 dimensions, 20 rendered search results, three suggested tags and eight persisted Whistle segments from the whole-track candidate. The subsequent index refresh completed. Listening-history rows remained zero. The four additive-seeding regression cases also passed.

The final production build was checked again on 2026-10-19 through actual login, Explore and the recommendation disclosure. It showed 37/37 indexed tracks, 20 cached cold-start recommendations, zero qualified plays, a non-stale snapshot and a next refresh exactly 24 hours after generation. The Windows launcher started both the production web server and recommendation worker. This verifies the daily contract on the real local library; it does not turn cold-start recommendations into a measured personalization-quality result.
