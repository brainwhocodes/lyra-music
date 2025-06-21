import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

import { radioChannels } from './radio-channels';
import { artists } from './artists';

export const radioChannelArtists = sqliteTable('radio_channel_artists',
  {
    channelId: text('channel_id').notNull().references(() => radioChannels.channelId, { onDelete: 'cascade' }),
    artistId: text('artist_id').notNull().references(() => artists.artistId, { onDelete: 'cascade' }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.channelId, table.artistId] }),
    };
  },
);

export type RadioChannelArtist = InferSelectModel<typeof radioChannelArtists>;
export type NewRadioChannelArtist = InferInsertModel<typeof radioChannelArtists>;
