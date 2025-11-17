import { sqliteTable, text, primaryKey } from 'drizzle-orm/sqlite-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

import { radioChannels } from './radio-channels';
import { genres } from './genres';

export const radioChannelGenres = sqliteTable('radio_channel_genres',
  {
    channelId: text('channel_id').notNull().references(() => radioChannels.channelId, { onDelete: 'cascade' }),
    genreId: text('genre_id').notNull().references(() => genres.genreId, { onDelete: 'cascade' }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.channelId, table.genreId] }),
    };
  },
);

export type RadioChannelGenre = InferSelectModel<typeof radioChannelGenres>;
export type NewRadioChannelGenre = InferInsertModel<typeof radioChannelGenres>;
