// types/musicbrainz/musicbrainz.ts

export interface MusicBrainzArea {
  id: string;
  name: string;
  'sort-name': string;
  disambiguation?: string;
  'iso-3166-1-codes'?: string[];
}

export interface MusicBrainzLifeSpan {
  begin?: string | null;
  end?: string | null;
  ended?: boolean | null;
}

export interface MusicBrainzAlias {
  name: string;
  'sort-name': string;
  type?: string | null;
  locale?: string | null;
  primary?: boolean | null;
  begin?: string | null;
  end?: string | null;
}

export interface MusicBrainzTag {
  count: number;
  name: string;
}

export interface MusicBrainzRating {
  'votes-count': number;
  value: number | null;
}

export interface MusicBrainzGenre {
  id: string;
  name: string;
  count?: number;
  disambiguation?: string;
}

export interface MusicBrainzArtist {
  id: string;
  name: string;
  'sort-name': string;
  disambiguation?: string;
  aliases?: MusicBrainzAlias[];
  country?: string;
  area?: MusicBrainzArea;
  'begin-area'?: MusicBrainzArea;
  'end-area'?: MusicBrainzArea;
  'life-span'?: MusicBrainzLifeSpan;
  tags?: MusicBrainzTag[];
  rating?: MusicBrainzRating;
  gender?: string | null;
  type?: string | null;
  'type-id'?: string;
  ipis?: string[];
  isnis?: string[];
  relations?: MusicBrainzRelation[];
}

export interface MusicBrainzArtistCredit {
  artist: MusicBrainzArtist;
  name: string; // The credited name
  joinphrase: string;
}

export interface MusicBrainzReleaseGroup {
  id: string;
  title: string;
  'primary-type'?: string | null;
  'secondary-types'?: string[];
  disambiguation?: string;
  'first-release-date'?: string;
  'artist-credit'?: MusicBrainzArtistCredit[];
}

export interface MusicBrainzLabelInfo {
  label?: {
    id: string;
    name: string;
    'label-code'?: number;
    disambiguation?: string;
    type?: string | null;
  };
  'catalog-number'?: string;
}

// Forward declaration for MusicBrainzRelease to be used in MusicBrainzRecording
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MusicBrainzRelease extends MusicBrainzReleaseBase {}

export interface MusicBrainzRecording {
  id: string;
  title: string;
  length?: number | null;
  disambiguation?: string;
  'artist-credit'?: MusicBrainzArtistCredit[];
  'first-release-date'?: string;
  video?: boolean | null;
  isrcs?: string[];
  tags?: MusicBrainzTag[];
  genres?: MusicBrainzGenre[];
  rating?: MusicBrainzRating;
  releases?: MusicBrainzRelease[]; // Uses the forward-declared MusicBrainzRelease
}

export interface MusicBrainzMediumTrack {
  id: string;
  position: number;
  number: string;
  title: string;
  length?: number | null;
  'artist-credit'?: MusicBrainzArtistCredit[];
  recording: MusicBrainzRecording;
}

export interface MusicBrainzMedium {
  format?: string;
  'disc-count'?: number;
  'track-count': number;
  position?: number;
  title?: string;
  tracks?: MusicBrainzMediumTrack[];
}

export interface MusicBrainzReleaseEvent {
  date?: string;
  area?: MusicBrainzArea;
}

export interface MusicBrainzTextRepresentation {
  language?: string;
  script?: string;
}

export interface MusicBrainzRelationTargetEntity {
  id: string;
  type?: string;
  name?: string;
  title?: string;
  disambiguation?: string;
}

export interface MusicBrainzRelationUrlEntity {
  id: string;
  resource: string;
}

export interface MusicBrainzRelation {
  type: string;
  'type-id': string;
  target: string | MusicBrainzRelationTargetEntity;
  direction?: string;
  attributes?: string[];
  'attribute-values'?: Record<string, string>;
  ended?: boolean;
  begin?: string | null;
  end?: string | null;
  'source-credit'?: string;
  'target-credit'?: string;
  url?: MusicBrainzRelationUrlEntity;
  artist?: MusicBrainzArtist;
  release?: MusicBrainzRelease; // Uses the forward-declared MusicBrainzRelease
  // Other related entity types can be added here as needed
}

interface MusicBrainzReleaseBase {
  id: string;
  title: string;
  'status-id'?: string;
  status?: string;
  disambiguation?: string;
  quality?: string;
  'artist-credit'?: MusicBrainzArtistCredit[];
  date?: string;
  country?: string;
  'release-events'?: MusicBrainzReleaseEvent[];
  'label-info'?: MusicBrainzLabelInfo[];
  'track-count'?: number;
  media?: MusicBrainzMedium[];
  'release-group'?: MusicBrainzReleaseGroup;
  'text-representation'?: MusicBrainzTextRepresentation;
  barcode?: string;
  asin?: string;
  'cover-art-archive'?: CoverArtArchiveResponse; // Defined below
  packaging?: string | null;
  'packaging-id'?: string | null;
  tags?: MusicBrainzTag[];
  relations?: MusicBrainzRelation[];
}

// Actual definition of MusicBrainzRelease now that all its dependent types are defined
// export interface MusicBrainzRelease extends MusicBrainzReleaseBase {} // Already declared for forward reference


export interface MusicBrainzReleaseTrackDetail {
  recordingId: string;
  title: string;
  trackNumber: number; // Position on the medium
  diskNumber: number;  // Position of the medium
  length: number | null; // Duration in milliseconds
}

export interface MusicBrainzTrackInfo {
  id: string;
  title: string;
  length?: number | null;
  disambiguation?: string;
  'artist-credit': MusicBrainzArtistCredit[];
  'first-release-date'?: string;
  releases?: MusicBrainzRelease[];
  video?: boolean | null;
  tags?: MusicBrainzTag[];
  rating?: MusicBrainzRating;
  genres?: MusicBrainzGenre[];
  isrcs?: string[];
}

export interface MusicBrainzRecordingSearchResult {
  created?: string;
  count?: number;
  offset?: number;
  recordings: MusicBrainzRecording[];
}

export interface MusicBrainzReleaseSearchResponse {
  created?: string;
  count?: number;
  offset?: number;
  releases: MusicBrainzRelease[];
}

export interface MusicBrainzArtistSearchResponse {
  created?: string;
  count?: number;
  offset?: number;
  artists: MusicBrainzArtist[];
}

export interface CoverArtArchiveImage {
  approved: boolean;
  back: boolean;
  comment: string;
  edit: number;
  front: boolean;
  id: string;
  image: string;
  thumbnails: {
    large: string;
    small: string;
    '250'?: string;
    '500'?: string;
    '1200'?: string;
  };
  types: string[];
}

export interface CoverArtArchiveResponse {
  images: CoverArtArchiveImage[];
  release: string; // URL to the MusicBrainz release entity
}

export interface MusicBrainzReleaseWithRelations extends MusicBrainzRelease {
  // This interface now correctly inherits 'relations?: MusicBrainzRelation[]'
  // from MusicBrainzRelease. It serves as a marker type to indicate that
  // relations are expected to be populated.
}
