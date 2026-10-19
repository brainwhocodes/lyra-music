import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { seedLocalListener } from '../../scripts/local-listener-data.mjs';

const opened: Database.Database[] = [];
const now = new Date().toISOString();
function database() {
  const db = new Database(':memory:'); opened.push(db);
  db.exec(readFileSync('server/db/migrations/0000_sloppy_mole_man.sql', 'utf8'));
  db.exec(readFileSync('server/db/migrations/0002_colossal_christian_walker.sql', 'utf8'));
  db.exec(readFileSync('server/db/migrations/0003_track_embeddings.sql', 'utf8'));
  return db;
}
function user(db: Database.Database, id: string, email: string) {
  db.prepare('INSERT INTO users(user_id,name,email,password_hash,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(id, 'Listener', email, 'unchanged password sentinel', now, now);
}
function corpus() {
  const db = database(), owner = randomUUID(); user(db, owner, 'source@example.test');
  db.prepare('INSERT INTO albums(album_id,title,user_id,cover_path,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('album', '日本語 album', owner, '/uploads/images/covers/source.webp', now, now);
  db.prepare('INSERT INTO tracks(track_id,title,album_id,file_path,created_at,updated_at) VALUES(?,?,?,?,?,?)').run('track', 'Real metadata 日本語', 'album', '/verified/source.ogg', now, now);
  db.prepare('INSERT INTO artists(artist_id,name,created_at,updated_at) VALUES(?,?,?,?)').run('artist', 'Source artist', now, now);
  db.prepare('INSERT INTO album_artists(album_artist_id,album_id,artist_id,created_at) VALUES(?,?,?,?)').run('aa', 'album', 'artist', now);
  db.prepare('INSERT INTO artists_tracks(artists_tracks_id,artist_id,track_id,created_at,updated_at) VALUES(?,?,?,?,?)').run('at', 'artist', 'track', now, now);
  return { db, owner };
}
afterEach(() => { for (const db of opened.splice(0)) db.close(); });
describe('additive local listener seed', () => {
  it('owns fresh metadata, preserves users and never copies lyrics, listening or vectors', () => {
    const source = corpus(), target = database(), owner = randomUUID(), other = randomUUID();
    user(target, owner, 'new@example.test'); user(target, other, 'existing@example.test');
    const before = target.prepare('SELECT * FROM users').all();
    expect(seedLocalListener(target, source.db, source.owner, owner)).toEqual({ reused: false, albums: 1, tracks: 1 });
    expect(target.prepare('SELECT * FROM users').all()).toEqual(before);
    expect(target.prepare('SELECT user_id FROM albums').get()).toEqual({ user_id: owner });
    expect(target.prepare('SELECT title FROM tracks').get()).toEqual({ title: 'Real metadata 日本語' });
    for (const table of ['lyrics', 'user_track_plays', 'track_embeddings']) expect(target.prepare(`SELECT count(*) n FROM ${table}`).get()).toEqual({ n: 0 });
  });
  it('reruns without resetting a renamed track or adding duplicates', () => {
    const source = corpus(), target = database(), owner = randomUUID(); user(target, owner, 'new@example.test');
    seedLocalListener(target, source.db, source.owner, owner);
    target.prepare('UPDATE tracks SET title=?').run('User edited title');
    expect(seedLocalListener(target, source.db, source.owner, owner).reused).toBe(true);
    expect(target.prepare('SELECT title FROM tracks').all()).toEqual([{ title: 'User edited title' }]);
    expect(target.prepare('SELECT count(*) n FROM artist_users').get()).toEqual({ n: 1 });
  });
  it('refuses an existing audio path owned by another user and leaves every row intact', () => {
    const source = corpus(), target = database(), owner = randomUUID(), other = randomUUID();
    user(target, owner, 'new@example.test'); user(target, other, 'existing@example.test');
    seedLocalListener(target, source.db, source.owner, other);
    const before = target.prepare('SELECT * FROM albums').all();
    expect(() => seedLocalListener(target, source.db, source.owner, owner)).toThrow('refusing reassignment');
    expect(target.prepare('SELECT * FROM albums').all()).toEqual(before);
    expect(target.prepare('SELECT count(*) n FROM artists').get()).toEqual({ n: 1 });
  });
  it('does not silently recreate a track that the listener deleted', () => {
    const source = corpus(), target = database(), owner = randomUUID(); user(target, owner, 'new@example.test');
    seedLocalListener(target, source.db, source.owner, owner);
    target.exec('DELETE FROM tracks');
    expect(() => seedLocalListener(target, source.db, source.owner, owner)).toThrow('refusing to restore');
    expect(target.prepare('SELECT count(*) n FROM tracks').get()).toEqual({ n: 0 });
  });
});
