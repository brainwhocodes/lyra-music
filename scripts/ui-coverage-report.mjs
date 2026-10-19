import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';

const target = resolve('tests/e2e/ui-coverage.json');
const loadingEvidence = [
  { testedBy: 'tests/e2e/loading-states.spec.ts', journey: 'collection skeletons follow genuine pending requests and yield to usable content', actions: ['Navigate through library and seven collection families while their real responses are held', 'Release the original responses and open a station'], assertions: ['Named busy loading statuses reserve content space', 'Decorative placeholders contain no controls', 'Actual collection links replace loading states', 'Station navigation succeeds'], selectorUsed: 'getByRole; delayed actual HTTP responses; read-only placeholder geometry' },
  { testedBy: 'tests/e2e/loading-states.spec.ts', journey: 'detail skeletons honor reduced motion, preserve focus and disappear after real responses', actions: ['Enable reduced motion', 'Open seven details with actual responses held', 'Release responses', 'Open and cancel album playlist picker'], assertions: ['Busy detail status is visible while response is pending', 'Placeholder animation is disabled by reduced motion', 'Real headings replace skeletons', 'Existing picker remains usable'], selectorUsed: 'getByRole; delayed actual HTTP responses; read-only animation styles' },
  { testedBy: 'tests/e2e/loading-states.spec.ts', journey: 'playlist loading errors remain recoverable after the session changes in another tab', actions: ['Log out in another real tab', 'Open playlist picker while the genuine unauthorized response is held', 'Release the response', 'Sign in in the other tab', 'Retry loading playlists', 'Cancel and reload'], assertions: ['Pending picker keeps Cancel focused', 'Real401 renders an honest error instead of empty playlists', 'Retry returns real playlist choices', 'Authenticated SSR reload remains usable'], selectorUsed: 'getByRole; shared browser context and real session endpoints' },
];
const testFile = 'tests/e2e/local-library.spec.ts';
const coreFile = 'tests/e2e/core-library.spec.ts';
const exploreFile = 'tests/e2e/explore.spec.ts';
const utilityFile = 'tests/e2e/utility-journeys.spec.ts';
const brandEvidence = { testedBy: 'tests/e2e/brand-journeys.spec.ts', journey: 'the radio landing loads its real brand fonts and routes every listening CTA', actions: ['Read rendered heading/body styles and loaded native font faces', 'Verify decoded responsive radio artwork', 'Open search/library as a guest', 'Open both registration links', 'Follow every instance of five authenticated listening link labels'], assertions: ['Space Grotesk and Barlow Condensed actually loaded, including the requested heading weight', 'Own your frequency heading and decoded hero', 'Guests reach login; registration reaches its form', 'Authenticated links reach radio, library, tracks and Explore'], selectorUsed: 'getByRole; read-only rendered font/image state' };
const landingEvidence = { testedBy: 'tests/e2e/brand-journeys.spec.ts', journey: 'long landing pages load responsive art and expose keyboard-operable questions', actions: ['Toggle every public FAQ with Enter and Space', 'Scroll through real lazy-loaded artwork'], assertions: ['Each disclosure changes and restores its open state', 'One semantic main, decoded AVIF/WebP sources, no horizontal overflow', 'Automated accessibility scan'], selectorUsed: 'summary focus / native keyboard / read-only image state' };
const evidence = [
  { pattern: /^(you@example\.com|\*{8}|Login|Register)$/, journey: 'login rejects invalid credentials and supports registration navigation and keyboard submission', actions: ['Fill email/password', 'Show and hide the filled password', 'Submit invalid and correct credentials', 'Navigate Register and Login', 'Press Enter on Login'], assertions: ['Password input type changes while its value is preserved', 'Validation and wrong-password messages visible', '401 response and no auth cookie for rejection', 'Correct credentials navigate to /library'], selectorUsed: 'getByLabel / getByRole' },
  { journey: 'search finds a real album and playback decodes its licensed audio', actions: ['Search Mono', 'Open album and click The Distant Sun row', 'Wait for real audio and advancing native position', 'Pointer and keyboard seek; pause/resume', 'Open Volume, change its range with keyboard, mute/unmute across player views and dismiss with Escape', 'Desktop queue/repeat; tablet/mobile full-screen open/close'], assertions: ['Album URL and track visible', 'Real audio response; advancing playback position', 'Seek changes while paused state is retained', 'Volume remembers 20 percent across desktop compact/full views; all widths preserve the last nonzero value', 'Popover Escape restores trigger focus', 'Pause/resume and queue/repeat states change'], selectorUsed: 'getByRole / keyboard / real pointer click' },
  { pattern: /^(Albums|Search albums|Search albums\.\.\.|Search albums by title or artist\.\.\.)$/, journey: 'album navigation and filtering show populated and empty library states', actions: ['Navigate Albums', 'Search missing title', 'Search Scott', 'Open Library Songs 5 card'], assertions: ['Two album headings', 'Empty message', 'Two album headings restored', 'Signal to Noise row visible on album URL'], selectorUsed: 'getByRole / getByPlaceholder' },
  { pattern: /^(Open navigation menu|Playlists|New Playlist|My Awesome Playlist|Close create playlist|Cancel|Create|Search Playlists\.\.\.)$/, journey: 'playlist creation supports cancellation, Escape, validation, search and persistence', actions: ['Open navigation on mobile', 'Open playlist modal', 'Cancel, close, Escape and reopen', 'Fill playlist name and create', 'Reload, filter, duplicate and retry'], assertions: ['Navigation expanded', 'Dialog/focus states', 'Blank create disabled', 'Playlist persists', '409 visible and retry enabled'], selectorUsed: 'getByRole / getByLabel / getByPlaceholder' },
];

const coreEvidence = [
  { testedBy: coreFile, journey: 'album views, sorting, menu keyboard behavior and playlist selection stay usable', actions: ['Select album sort', 'Switch List/Grid views', 'Open Monomyth', 'Open track menu with Enter; close with Escape', 'Cancel playlist picker; reopen and select Local listening'], assertions: ['Sort and pressed states change', 'Options menu closes and restores focus', 'Playlist selection succeeds', 'Artist link navigates without starting playback'], selectorUsed: 'getByRole / keyboard' },
  { testedBy: coreFile, journey: 'artist, genre and track discovery filters navigate and play real local tracks', actions: ['Filter artists, genres and tracks', 'Select artist and track sort', 'Open artist and genre detail', 'Start track using Enter; pause', 'Play genre and pause'], assertions: ['Empty and populated results', 'Correct URLs and track lists', 'Real audio response and playing state', 'No horizontal overflow'], selectorUsed: 'getByRole / keyboard' },
  { testedBy: coreFile, journey: 'registration validates confirmation, creates a local account and signs out', actions: ['Fill registration fields', 'Show/hide password', 'Submit mismatched confirmation; correct and submit', 'Log out; revisit protected library'], assertions: ['Password input type changes while its value is preserved', 'Mismatch error visible', 'New account reaches empty library', 'Protected route redirects to login after logout'], selectorUsed: 'getByRole / getByLabel' },
];
const exploreEvidence = { testedBy: exploreFile, journey: 'local semantic discovery indexes, searches, explains suggestions and plays the collection', actions: ['Index local library and stop after current batch on first run', 'Check for changes', 'Search Scott Buckley', 'Show and hide suggested tags', 'Play and pause a result', 'Switch For you and Search results', 'Open album'], assertions: ['Two owned tracks indexed', 'Real model returns licensed tracks', 'Model provenance visible', 'Real audio response', 'Correct selected view and album URL'], selectorUsed: 'getByRole / getByLabel' };
const utilityEvidence = [
  { testedBy: utilityFile, journey: 'a playlist can add, reorder, rename, remove and persist tracks without dragging', actions: ['Create separate playlist', 'Search and select two tracks', 'Move a track down', 'Rename, play, pause and remove a track', 'Reload; cancel then confirm deletion'], assertions: ['Order changes and boundary button disabled', 'Rename and remaining track persist after reload', 'Deletion returns to list', 'Dialog focus and accessibility'], selectorUsed: 'getByRole / getByLabel / keyboard' },
  { testedBy: utilityFile, journey: 'podcast RSS subscription, feed refresh, audio playback and unsubscribe use a real local publisher', actions: ['Subscribe to local Field Notes RSS', 'Open podcast and update feed', 'Play latest episode; observe progress; pause', 'Pointer and keyboard seek beyond half of the episode', 'Cancel then confirm unsubscribe'], assertions: ['Real subscription and episode metadata', 'Licensed audio from external fixture publisher decodes', 'External episode seeking submits no music-history requests', 'Unsubscribe removes only Field Notes'], selectorUsed: 'getByRole / getByLabel / keyboard' },
  { testedBy: utilityFile, journey: 'radio stations can be created, played, edited and deleted with artist and genre seeds', actions: ['Create station with artist and genre seeds', 'Play from station detail and index card; observe advancing progress; pause', 'Rename and remove genre seed', 'Upload logo/background; cancel, save, reload, remove and save', 'Search and filter stations through empty and restored results', 'Create and play a seedless station', 'Cancel then confirm deletion'], assertions: ['Real audio responses and advancing playback progress', 'Name and seed changes persist', 'Uploaded images serve and decode after reload; removal persists', 'Search/genre filters show empty state and restore the actual station', 'Actual empty queue gives a correction without starting audio', 'Temporary stations deleted'], selectorUsed: 'getByRole / getByLabel' },
  { testedBy: utilityFile, journey: 'discovery collections filter, play and save as an editable playlist', actions: ['Filter discovery collections', 'Play/pause collection', 'Save as named playlist', 'Reload then delete temporary playlist'], assertions: ['Filtered results restore', 'Playback state', 'Two real tracks persist in saved playlist'], selectorUsed: 'getByRole / getByLabel' },
  { testedBy: utilityFile, journey: 'settings can browse, add, scan and remove an isolated empty music folder', actions: ['Open folder browser; dismiss with Escape', 'Add isolated empty folder and reload', 'Queue scan', 'Cancel then confirm folder removal'], assertions: ['Browser focus and return', 'Folder persists', '202 response and actual queued state; pending job cancelled', 'Folder removed from list'], selectorUsed: 'getByRole / getByLabel / keyboard; actual HTTP status and cancellation for queue cleanup' },
];
const playerEvidence = { testedBy: 'tests/e2e/player-states.spec.ts', journey: 'lyrics ignore an obsolete real response and queue dialogs support keyboard focus and clearing', actions: ['Hold actual first lyrics response while real audio auto-advances', 'Release obsolete response', 'Toggle lyric auto-scroll and activate timed line using Enter', 'Dismiss lyrics and queue with Escape', 'Keyboard play/pause a queued track; clear queue', 'Mobile/tablet full player close/reopen'], assertions: ['Only current-track fixture text remains', 'Both recordings have complete waveforms and one identified HTTP206 original-stream request each', 'Lyrics and queue focus restoration', 'Queue playing state changes', 'Clear queue removes player'], selectorUsed: 'getByRole / keyboard; delayed real route.fetch response' };

const modalEvidence = { testedBy: 'tests/e2e/shared-modals.spec.ts', journey: 'album, track and lyric editors persist changes and shared playlist selection supports keyboard focus', actions: ['Preview album cover and cancel', 'Save album year then restore', 'Validate blank track title; save changed title then restore', 'Add, edit and remove manual lyric lines; save and reopen', 'Add discovery track to playlist'], assertions: ['Dialog initial and returned focus', 'Year/title changes persist after reload', 'Original manual lyric text persists', 'Selected playlist contains the track'], selectorUsed: 'getByRole / getByLabel / keyboard / file input' };
const scalingEvidence = { testedBy: 'tests/e2e/text-scaling.spec.ts', journey: 'public, library, player and dialog controls remain usable with text doubled', actions: ['Apply equivalent doubled-text user stylesheet', 'Open search from public page; authenticate', 'Verify compact navigation at doubled text', 'Open album and compact fullscreen player; play, pause and seek; close', 'Open and fill playlist dialog; dismiss with Escape', 'Search Quiet on Radio and open its station'], assertions: ['32px body text and compact navigation', 'No document overflow', 'Seek position changes', 'Dialog focus, enabled submit, dismissal and focus return', 'Exact radio detail URL and level-1 heading'], selectorUsed: 'getByRole / getByLabel / keyboard; read-only geometry' };
const scalingRadioStateEvidence = { ...scalingEvidence, stateOnly: true, actions: ['Scroll each control independently into view', 'Check native trial-click actionability without activation', 'Read control geometry and five inset hit-test points'], assertions: ['The reached control is fully in the viewport', 'All five points hit the control or its descendant rather than the fixed player'], selectorUsed: 'getByRole / scrollIntoViewIfNeeded / trial click; read-only elementFromPoint' };
const scalingRadioDisabledEvidence = { ...scalingEvidence, stateOnly: true, actions: ['Scroll Next track into view without activating it'], assertions: ['Next track is fully in the viewport and disabled before starting this station'], selectorUsed: 'getByRole / scrollIntoViewIfNeeded / toBeDisabled' };
const waveformEvidence = [
  { testedBy: 'tests/e2e/audio-analysis.spec.ts', journey: 'a decoded waveform shares the native seek bar and preserves playback across cached views', actions: ['Hold actual original audio while playing and keyboard seeking', 'Release actual audio for automatic full waveform decoding', 'Pointer seek while paused and playing; Home/arrow seek', 'Close and reopen the full player'], assertions: ['Plain seek remains usable while loading', 'Finite varying decorative waveform bins cover the timeline and overlap its native seek target', 'Actual playback progresses after seeking while playing; paused seeking stays paused', 'One decode request shared across compact/full views'], selectorUsed: 'getByRole / keyboard / real pointer; read-only decorative SVG geometry' },
  { testedBy: 'tests/e2e/audio-analysis.spec.ts', journey: 'malformed waveform audio leaves seeking usable and retries when the track is selected again', actions: ['Buffer genuine playback before corrupting only the isolated temporary waveform source', 'Release real server fetch and observe decoder fallback', 'Pointer and keyboard seek', 'Restore bytes; select another track then return'], assertions: ['Unavailable status with plain seek still enabled', 'Track and paused position preserved', 'Failed decode is not cached; returning retries actual original bytes successfully'], selectorUsed: 'getByRole / keyboard / real pointer; isolated real filesystem fixture arrangement' },
  { testedBy: 'tests/e2e/audio-analysis.spec.ts', journey: 'pending waveform survives player closure and aborts when the current track changes', actions: ['Hold actual original audio while native playback advances', 'Pause/seek then close and reopen full player', 'Select the other actual queued track', 'Return to the original track'], assertions: ['Closing a view retains current-track request', 'Track replacement emits native ERR_ABORTED', 'Current waveform differs across the two actual recordings', 'Aborted result is not cached'], selectorUsed: 'getByRole / keyboard; delayed actual response and read-only geometry/position' },
];
const radioSelectionEvidence = { testedBy: 'tests/e2e/radio-selection.spec.ts', journey: 'choosing the current station cancels a pending station without replacing its queue or playback position', actions: ['Play current station A; pause and seek; observe queue', 'Resume, begin station B and hold its real queue response', 'Choose current A again', 'Reopen player and queue'], assertions: ['Pending B emits ERR_ABORTED', 'Only one A queue request', 'Retained title, queue order and position', 'Current native playback is paused'], selectorUsed: 'getByRole; actual HTTP request counting and delayed response; read-only queue labels/progress' };

function viewportFor(file) {
  if (basename(file) === 'text200-volume-resize.inventory.json') return 'compact320-text200';
  if (basename(file).startsWith('text200-compact320-')) return 'compact320-text200';
  if (basename(file).startsWith('compact320-')) return 'compact320';
  return /-mobile[\\/]/.test(file) ? 'mobile' : /-tablet[\\/]/.test(file) ? 'tablet' : 'desktop';
}

function coverageFor(control, surface, viewport) {
  const name = control.name?.trim() || '';
  const { tag, href } = control;
  if (surface === 'skeleton-playlist-picker' || surface === 'playlist-picker-load-error') {
    if (control.role === 'status' && name === 'Loading playlists…') return { ...loadingEvidence[2], stateOnly: true };
    if (control.role === 'alert' && /Could not load playlists/.test(name)) return { ...loadingEvidence[2], stateOnly: true };
    if (tag === 'button' && ['Retry loading playlists', 'Cancel'].includes(name)) return loadingEvidence[2];
  }
  if (surface.startsWith('skeleton-') && control.role === 'status' && /^Loading /.test(name)) return { ...loadingEvidence[surface.startsWith('skeleton-detail-') ? 1 : 0], stateOnly: true };
  // Route sweeps observe controls but do not operate them. Do not upgrade these
  // occurrences merely because a similarly named control was used elsewhere.
  if (surface.startsWith('route-') || surface.startsWith('compact320-')) return undefined;
  if (['text200-player', 'text200-waveform', 'text200-volume', 'text200-compact320-transport', 'text200-compact320-waveform', 'text200-compact320-volume'].includes(surface)) {
    if (tag === 'input' && name === 'Playback position') return { ...scalingEvidence, actions: ['Pointer and keyboard seek at doubled text and combined 320px/200% text', 'Inspect five actual seek hit points'], assertions: ['Native position changes and paused state remains', 'Decorative waveform shares the seek target', 'No document/dialog/transport overflow'] };
    if (surface === 'text200-compact320-waveform' && tag === 'button' && name === 'Play playback') return { ...scalingEvidence, stateOnly: true, actions: ['Read the paused primary Play control bounding box at 320px with doubled text'], assertions: ['The circular control has equal width and height within one pixel'] };
    if (['text200-volume', 'text200-compact320-volume'].includes(surface) && ((tag === 'button' && name === 'Volume') || (tag === 'input' && name === 'Volume level'))) return { ...scalingEvidence, actions: ['Open Volume and inspect its hit target', 'Keyboard change volume', 'Dismiss by resize or Escape'], assertions: ['Volume changes to 99 percent', 'Popover fits the observed doubled-text viewport', 'Focus returns to Volume'] };
  }
  if (surface === 'text200-volume-resize' && tag === 'button' && name === 'Volume') return { ...scalingEvidence, stateOnly: true, actions: ['Resize from desktop to 320px while the Volume popover is open'], assertions: ['Popover closes or remains fully inside the resized viewport', 'Volume is collapsed and regains focus'] };
  if (surface === 'podcast-plain-seek') {
    if (tag === 'button' && name === 'Close full screen player') return utilityEvidence[1];
    if (tag === 'input' && name === 'Playback position') return { ...utilityEvidence[1], actions: ['Pointer and keyboard seek the actual external episode'], assertions: ['Episode playback advances and seeking works while paused', 'No waveform or original-track stream request'] };
    if (tag === 'button' && name === 'Play playback') return { ...utilityEvidence[1], stateOnly: true, assertions: ['External episode decoded and advanced', 'Paused native playback remains usable'] };
  }
  if (surface.startsWith('waveform-')) {
    const match = ['waveform-error-fallback', 'waveform-recovered'].includes(surface) ? waveformEvidence[1] : ['waveform-pending-shared', 'waveform-current-track'].includes(surface) ? waveformEvidence[2] : waveformEvidence[0];
    if (control.role === 'status' && /^(Waveform ready|Loading waveform|Waveform unavailable\. Seeking is still available\.)$/.test(name)) return { ...match, stateOnly: true };
    if (tag === 'input' && name === 'Playback position') return match;
    if (tag === 'button' && /^(Play playback|Pause playback)$/.test(name)) return name === 'Play playback' && match !== waveformEvidence[0] ? { ...match, stateOnly: true } : match;
    if (['waveform-pending-shared', 'waveform-current-track', 'waveform-seeking-paused'].includes(surface) && tag === 'button' && name === 'Close full screen player') return match;
    if (['waveform-error-fallback', 'waveform-recovered', 'waveform-pending-shared', 'waveform-current-track'].includes(surface) && tag === 'button' && name === 'Up Next') return match;
  }
  if (surface === 'radio-current-station-preserved') {
    if ((tag === 'button' && /^(Up Next|Close full screen player)$/.test(name)) || (tag === 'input' && name === 'Playback position')) return radioSelectionEvidence;
    if (tag === 'button' && name === 'Play playback') return { ...radioSelectionEvidence, stateOnly: true };
  }
  if (surface.startsWith('marketing-') && tag === 'summary') return landingEvidence;
  if ((surface === 'brand-landing' || surface.startsWith('marketing-')) && tag === 'a' && [
    ['Find your station', '/radio'], ['Open your library', '/library'],
    ['Choose a track', '/tracks'], ['Explore your collection', '/explore'],
    ['Try a search', '/explore'], ['Create an account', '/register'],
  ].some(([label, destination]) => name === label && href === destination)) return brandEvidence;
  if (surface === 'login' && ((tag === 'input' && /^(Email|Password|you@example\.com|\*{8})$/.test(name)) || (tag === 'button' && /^(Login|Show password|Hide password)$/.test(name)) || (tag === 'a' && name === 'Register'))) return evidence[0];
  if (surface === 'registration') return tag === 'a' && name === 'Login' ? evidence[0] : undefined;
  if (['album-playing', 'full-screen-player'].includes(surface)) {
    if ((tag === 'input' && name === 'Playback position') || (tag === 'button' && /^(Play playback|Pause playback|Volume|Close full screen player|Open full screen player:.*)$/.test(name))) return evidence[1];
    if (viewport === 'desktop' && tag === 'button' && /^(Repeat mode: (none|all)|Show Queue|Hide Queue)$/.test(name)) return evidence[1];
  }
  if (surface === 'player-volume-popover' && ((tag === 'button' && /^(Volume|Mute|Unmute)$/.test(name)) || (tag === 'input' && name === 'Volume level'))) return evidence[1];
  if (surface === 'queue' && tag === 'button' && /^(Hide Queue|Show Queue)$/.test(name)) return evidence[1];
  if (tag === 'a' && name === 'Albums' && href === '/albums') return evidence[2];
  if (tag === 'a' && name === 'Playlists' && href === '/playlists') return evidence[3];
  if (tag === 'button' && name === 'Open navigation menu' && ['mobile', 'tablet'].includes(viewport)) return evidence[3];
  if (['library', 'search-results'].includes(surface) && tag === 'input' && name === 'Search library') return evidence[1];
  if (surface === 'search-results' && tag === 'a' && name === 'Monomyth' && href === '/albums/album-the-distant-sun') return evidence[1];
  if (surface === 'album-playing') {
    if (tag === 'tr' && /The Distant Sun/.test(name)) return evidence[1];
    if (tag === 'button' && /^(Play playback|Pause playback)$/.test(name)) return evidence[1];
    if (viewport === 'desktop' && ((tag === 'input' && /^(Playback position|Volume)$/.test(name)) || (tag === 'button' && /^(Show Queue|Hide Queue|Repeat Mode: (none|all))$/.test(name)))) return evidence[1];
    if (viewport === 'mobile' && tag === 'div' && control.pointerCandidate && name === 'The Distant SunScott Buckley') return evidence[1];
  }
  if (surface === 'albums') {
    if (tag === 'input' && /^Search albums(\.\.\.| by title or artist\.\.\.)?$/.test(name)) return evidence[2];
    if (tag === 'a' && name === 'Library Songs 5' && href === '/albums/album-signal-to-noise') return evidence[2];
  }
  if (['playlists', 'playlist-dialog'].includes(surface)) {
    if (tag === 'button' && name === 'New Playlist') return evidence[3];
    if (tag === 'input' && /^(Search Playlists\.\.\.|Search playlists)$/.test(name)) return evidence[3];
  }
  if (surface === 'playlist-dialog' && ((tag === 'input' && /^(My Awesome Playlist|Playlist Name)$/.test(name)) || (tag === 'button' && /^(Close create playlist|Cancel|Create)$/.test(name)))) return evidence[3];
  if (surface === 'albums-list' && ((tag === 'select' && name === 'Sort albums') || (tag === 'button' && /^(List view|Grid view)$/.test(name)) || (tag === 'a' && name === 'Monomyth' && href === '/albums/album-the-distant-sun'))) return coreEvidence[0];
  if (surface === 'track-options' && tag === 'button' && name === 'Open options menu') return coreEvidence[0];
  if (['album-playlist-picker','track-playlist-picker'].includes(surface) && tag === 'button' && /^(Cancel|Local listening)$/.test(name)) return coreEvidence[0];
  if (surface === 'artists-filtered' && ((tag === 'input' && name === 'Search artists') || (tag === 'select' && name === 'Sort artists') || (tag === 'a' && href === '/artists/scott-buckley'))) return coreEvidence[1];
  if (surface === 'artist-detail' && tag === 'button' && /^(Play|Pause) The Distant Sun$/.test(name)) return coreEvidence[1];
  if (surface === 'genre-detail' && tag === 'button' && /^(Play all|Pause playback)$/.test(name)) return coreEvidence[1];
  if (surface === 'tracks-filtered' && ((tag === 'input' && name === 'Search tracks') || (tag === 'select' && name === 'Sort tracks'))) return coreEvidence[1];
  if (surface === 'registration-filled' && ((tag === 'input' && /^(Email|Name|Password|Confirm Password|Access Code)$/.test(name)) || (tag === 'button' && /^(Show password|Hide password|Register)$/.test(name)))) return coreEvidence[2];
  if (surface === 'new-library' && tag === 'a' && href === '/logout' && name === 'Log out') return coreEvidence[2];
  if (surface.startsWith('explore-')) {
    if ((tag === 'input' && name === 'Describe the music you want') || (tag === 'button' && /^(Check for changes|Search|Search results|For you|(Show|Hide) suggested tags for The Distant Sun|(Play|Pause) The Distant Sun)$/.test(name)) || (tag === 'a' && href === '/albums/album-the-distant-sun' && name === 'Open album Monomyth')) return exploreEvidence;
    if (viewport === 'desktop' && tag === 'button' && /^(Index your library|Stop after this batch)$/.test(name)) return exploreEvidence;
  }
  if (surface === 'playlist-add-tracks' && ((tag === 'input' && /^(Search library tracks|The Distant Sun|Signal to Noise)/.test(name)) || (tag === 'button' && name === 'Add selected tracks (2)'))) return utilityEvidence[0];
  if (surface === 'playlist-edited' && tag === 'button' && /^(Delete playlist|Rename|Play all)$/.test(name)) return utilityEvidence[0];
  if (surface === 'playlist-delete' && tag === 'button' && /^(Delete|Cancel)$/.test(name)) return utilityEvidence[0];
  if (surface === 'podcasts-subscribed' && ((tag === 'input' && name === 'RSS feed URL') || (tag === 'button' && name === 'Subscribe') || (tag === 'a' && name === 'Field Notes'))) return utilityEvidence[1];
  if (surface === 'podcast-detail' && tag === 'button' && /^(Play latest episode|Update feed|Unsubscribe|Play playback|Pause playback)$/.test(name)) return utilityEvidence[1];
  if (surface === 'podcast-unsubscribe' && tag === 'button' && /^(Cancel|Unsubscribe)$/.test(name)) return utilityEvidence[1];
  if (surface === 'radio-create' && ((tag === 'input' && /^(Station Name|Scott Buckley|Ambient)$/.test(name)) || (tag === 'button' && name === 'Create Station'))) return utilityEvidence[2];
  if (surface === 'radio-playing' && ((tag === 'button' && /^(Play station|Pause station)$/.test(name)) || (tag === 'a' && name === 'Edit station'))) return utilityEvidence[2];
  if (['radio-filtered', 'radio-filter-empty', 'radio-empty-station'].includes(surface) && ((tag === 'input' && name === 'Search stations') || (tag === 'select' && name === 'Filter by genre'))) return utilityEvidence[2];
  if (surface === 'radio-filtered' && tag === 'button' && /^Play station Evening station (desktop|tablet|mobile) edited$/.test(name)) return utilityEvidence[2];
  if (surface === 'radio-empty-station' && tag === 'button' && /^Play station Unseeded station (desktop|tablet|mobile)$/.test(name)) return utilityEvidence[2];
  if (['radio-filter-empty', 'radio-empty-station'].includes(surface) && ['status', 'alert'].includes(control.role) && /^(No stations match these filters\.|No library tracks match this station yet\. Try editing its seeds\.)$/.test(name)) return { ...utilityEvidence[2], stateOnly: true };
  if (surface === 'radio-delete' && tag === 'button' && /^(Cancel|Delete)$/.test(name)) return utilityEvidence[2];
  if (surface === 'discovery-filtered' && ((tag === 'input' && name === 'Search discovery playlists') || (tag === 'button' && /^(Play Quiet discoveries|Play playback|Pause playback)$/.test(name)) || (tag === 'a' && name === 'Quiet discoveries'))) return utilityEvidence[3];
  if (surface === 'discovery-save' && ((tag === 'input' && name === 'Playlist Name') || (tag === 'button' && name === 'Save playlist'))) return utilityEvidence[3];
  if (surface === 'settings-folder-browser' && tag === 'button' && name === 'Cancel') return { ...utilityEvidence[4], stateOnly: true };
  if (surface === 'settings-scan-queued' && ((tag === 'input' && name === 'Folder path') || (tag === 'button' && /^(Browse|Add Folder|Scan All Folders|Remove folder )/.test(name)))) return utilityEvidence[4];
  if (surface === 'settings-remove-folder' && tag === 'button' && /^(Cancel|Remove folder)$/.test(name)) return utilityEvidence[4];
  if (surface === 'radio-images-saved' && ((tag === 'input' && /^(Choose logo image|Choose background image)$/.test(name)) || (tag === 'button' && /^(Save Images|Remove logo|Remove background)$/.test(name)))) return utilityEvidence[2];
  if (surface.startsWith('album-editor-') && ((tag === 'input' && /^(Title|Year|Cover image)$/.test(name)) || (tag === 'button' && /^(Save|Cancel)$/.test(name)))) return modalEvidence;
  if (surface.startsWith('track-editor-') && ((tag === 'input' && name === 'Title') || (tag === 'button' && name === 'Save Changes'))) return modalEvidence;
  if (surface === 'lyrics-editor' && ((tag === 'input' && /^(Time|Lyrics) (for )?line 1$/.test(name)) || (tag === 'button' && /^(Add Line|Save Changes)$/.test(name)))) return modalEvidence;
  if (surface === 'lyrics-editor' && tag === 'button' && name === 'Cancel') return { ...modalEvidence, stateOnly: true };
  if (surface === 'shared-playlist-picker' && tag === 'button' && name === 'Local listening') return modalEvidence;
  if (surface === 'shared-playlist-picker' && tag === 'button' && name === 'Cancel') return { ...modalEvidence, stateOnly: true };
  if (surface === 'text200-public' && tag === 'a' && name === 'Try a search') return scalingEvidence;
  if (surface.startsWith('text200-') && tag === 'a' && /^(Albums|Playlists)$/.test(name)) return scalingEvidence;
  if (surface === 'text200-player' && tag === 'button' && /^(Play album|Pause playback|Close full screen player)$/.test(name)) return scalingEvidence;
  if (surface === 'text200-dialog' && tag === 'input' && name === 'Playlist Name') return scalingEvidence;
  if (surface === 'text200-dialog' && tag === 'button' && name === 'Create') return { ...scalingEvidence, stateOnly: true };
  if (['text200-radio', 'text200-radio-search'].includes(surface) && tag === 'input' && name === 'Search stations') return scalingEvidence;
  if (surface === 'text200-radio-filter' && tag === 'select' && /^Filter by genre(?:All genresAmbient)?$/.test(name)) return scalingRadioStateEvidence;
  if (surface === 'text200-radio' && tag === 'a' && name === 'Quiet hours' && href === '/radio/quiet-hours') return scalingEvidence;
  if (surface === 'text200-radio-play' && tag === 'button' && name === 'Play station') return scalingRadioStateEvidence;
  if (surface === 'text200-radio-edit' && tag === 'a' && name === 'Edit station' && href === '/settings/radio/quiet-hours') return scalingRadioStateEvidence;
  if (surface === 'text200-radio-next-disabled' && tag === 'button' && name === 'Next track') return scalingRadioDisabledEvidence;
  if (surface === 'text200-radio-artist-seed' && tag === 'a' && /^Scott Buckley(?:\s*→)?$/.test(name) && href === '/artists/scott-buckley') return scalingRadioStateEvidence;
  if (surface === 'text200-radio-genre-seed' && tag === 'a' && /^Ambient(?:\s*→)?$/.test(name) && href === '/genres/ambient') return scalingRadioStateEvidence;
  if (surface === 'lyrics-current-track' && tag === 'button' && /^(Auto-scroll (on|off)|Jump to 00:01.*Original fixture line for the second track\.)$/.test(name)) return playerEvidence;
  if (surface === 'queue-keyboard' && tag === 'button' && /^(Play The Distant Sun|Pause The Distant Sun|Clear queue)$/.test(name)) return playerEvidence;
  return undefined;
}

function elementKey(file, control, index) {
  return `${viewportFor(file)}:${file.replaceAll('\\', '/')}:${index}:${control.role || control.tag}:${control.name?.trim() || '(unnamed control)'}:${control.href || ''}`;
}

async function inventorySourcesFor(roots) {
  const selected = new Map();
  for (const root of roots) {
    const files = (await readdir(resolve(root), { recursive: true })).filter(file => file.endsWith('.inventory.json'));
    for (const file of files) selected.set(file, { file, root });
  }
  return [...selected.values()].sort((a, b) => a.file.localeCompare(b.file));
}

if (process.argv.includes('--verify')) {
  const report = JSON.parse(await readFile(target, 'utf8'));
  const recordedRuns = report.evidenceRuns || [{ root: 'test-results', status: report.browserRunStatus, failedTestCount: report.failedTestCount }];
  for (const run of recordedRuns) {
    const lastRun = JSON.parse(await readFile(join(run.root, '.last-run.json'), 'utf8'));
    if (run.status !== lastRun.status || run.failedTestCount !== lastRun.failedTests.length) throw new Error('Browser run changed; regenerate coverage from the complete current evidence');
  }
  const sources = report.inventorySources || report.inventoryFiles.map(file => ({ file, root: 'test-results' }));
  const actualSources = await inventorySourcesFor(recordedRuns.map(run => run.root));
  if (JSON.stringify(sources) !== JSON.stringify(actualSources)) throw new Error('Inventory file set changed; regenerate coverage to retain every observation');
  if (new Set(report.elements.map(entry => entry.elementKey)).size !== report.elements.length) throw new Error('Duplicate element keys');
  if (report.elements.length !== report.inventoryElementCount) throw new Error('Coverage must retain one row per inventoried element');
  const observedKeys = [];
  for (const { file, root } of sources) {
    const inventory = JSON.parse(await readFile(join(root, file), 'utf8'));
    observedKeys.push(...inventory.map((control, index) => elementKey(file, control, index)));
  }
  if (JSON.stringify(observedKeys.sort()) !== JSON.stringify(report.elements.map(entry => entry.elementKey).sort())) throw new Error('Coverage keys do not match the actual browser inventories');
  for (const entry of report.elements) {
    if (!entry.elementKey || !entry.name || !entry.role || !entry.status) throw new Error(`Incomplete inventory entry: ${JSON.stringify(entry)}`);
    if (!['covered', 'grouped-covered', 'state-asserted', 'intentional-gap'].includes(entry.status)) throw new Error(`Unknown status: ${entry.status}`);
    if (entry.status === 'intentional-gap') {
      if (!entry.reason || !entry.owner || !entry.expires) throw new Error(`Missing gap ownership: ${entry.elementKey}`);
    } else if (!entry.testedBy || !entry.journey || !entry.actions?.length || !entry.assertions?.length || !entry.selectorUsed) {
      throw new Error(`Missing journey evidence: ${entry.elementKey}`);
    } else if (!(await readFile(entry.testedBy, 'utf8')).includes(entry.journey)) {
      throw new Error(`Journey is not present in its cited test file: ${entry.elementKey}`);
    }
  }
  console.log(`Verified ${report.elements.length} inventory coverage entries (${report.elements.filter(entry => entry.status === 'intentional-gap').length} explicit gaps); browser runs: ${recordedRuns.map(run => run.status).join(', ')}.`);
} else {
  const baseline = process.argv.find(value => value.startsWith('--baseline='))?.slice('--baseline='.length);
  const current = process.argv.find(value => value.startsWith('--current='))?.slice('--current='.length) || 'test-results';
  const roots = [...(baseline ? [baseline] : []), current];
  const sources = await inventorySourcesFor(roots);
  if (!sources.length) throw new Error('Run the browser journeys first to collect inventories.');
  const elements = [];
  for (const { file, root } of sources) {
    const surface = basename(file, '.inventory.json');
    const viewport = viewportFor(file);
    const controls = JSON.parse(await readFile(join(root, file), 'utf8'));
    for (const [index, control] of controls.entries()) {
      const name = control.name?.trim() || '(unnamed control)';
      const role = control.role || control.tag;
      const match = coverageFor(control, surface, viewport);
      const grouped = match?.grouped;
      elements.push({ elementKey: elementKey(file, control, index), inventoryRoot: root, surface, viewport, role, name, href: control.href,
        ...(match ? { status: match.stateOnly ? 'state-asserted' : grouped ? 'grouped-covered' : 'covered', journey: match.journey, testedBy: match.testedBy || testFile, actions: match.actions, assertions: match.assertions, selectorUsed: match.selectorUsed,
          notes: match.stateOnly ? 'The referenced journey asserts this element’s value, enabled state or focus; it does not claim activation in this snapshot.' : grouped ? 'Equivalent repeated controls are covered by the referenced representative action and count assertion.' : 'The referenced journey operates this control. Shared layout controls appear in multiple surface inventories.' }
          : { status: 'intentional-gap', reason: surface.startsWith('route-') || surface.startsWith('compact320-') ? 'Route sweep observes this control and checks layout/accessibility, but does not operate it in this state.' : 'This occurrence has no mapped action in the focused journeys; inventory retains it without claiming interaction coverage.', owner: 'Lyra maintainers', expires: '2026-11-18' }),
      });
    }
  }
  const evidenceRuns = await Promise.all(roots.map(async root => {
    const run = JSON.parse(await readFile(join(root, '.last-run.json'), 'utf8'));
    return { root, status: run.status, failedTestCount: run.failedTests.length };
  }));
  await writeFile(target, JSON.stringify({ observedOn: new Date().toISOString().slice(0, 10), verificationMode: process.argv.includes('--development') ? 'development' : 'production', browserRunStatus: evidenceRuns.every(run => run.status === 'passed') ? 'passed' : 'failed', failedTestCount: evidenceRuns.reduce((sum, run) => sum + run.failedTestCount, 0), evidenceRuns,
    source: 'Real Playwright inventories, including visible pointer candidates and associated input labels. When a baseline is supplied, current-run snapshots replace matching baseline snapshots; remaining baseline evidence retains its own root.',
    scope: 'All routes at desktop/tablet/mobile, compact authenticated routes and public/player/dialog views, doubled-text and combined 320px/200% text samples, and focused auth/library/player/waveform/editor/utility journeys. Model-runtime evidence is included only when its own journeys exist in the recorded runs. Route sweeps do not claim every control was operated.',
    inventoryFiles: sources.map(source => source.file), inventorySources: sources, inventoryElementCount: elements.length, elements }, null, 2) + '\n');
  console.log(`Wrote ${elements.length} coverage entries from ${sources.length} real browser inventories across ${evidenceRuns.length} run(s).`);
}
