import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cardKeyFromFullKey,
  cdnCardImageUrl,
  isCdnImageUrl,
  legacySupabaseStorageRef,
  r2KeyFromPublicUrl,
} from './imageCdn.ts';

test('detects the default image CDN host', () => {
  assert.equal(isCdnImageUrl('https://images.secretblogger.app/event/u/a.jpg'), true);
  assert.equal(
    isCdnImageUrl(
      'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/a.jpg',
    ),
    false,
  );
});

test('parses R2 keys and card siblings', () => {
  assert.equal(
    r2KeyFromPublicUrl('https://images.secretblogger.app/event/u/a.jpg'),
    'event/u/a.jpg',
  );
  assert.equal(cardKeyFromFullKey('event/u/a.jpg'), 'event/u/a.card.jpg');
  assert.equal(cardKeyFromFullKey('event/u/a.card.jpg'), 'event/u/a.card.jpg');
});

test('only event CDN paths get a card rewrite', () => {
  assert.equal(
    cdnCardImageUrl('https://images.secretblogger.app/event/u/a.jpg'),
    'https://images.secretblogger.app/event/u/a.card.jpg',
  );
  assert.equal(cdnCardImageUrl('https://images.secretblogger.app/profile/u/a.jpg'), null);
});

test('parses legacy supabase public objects', () => {
  const ref = legacySupabaseStorageRef(
    'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/user/photo.jpg',
  );
  assert.deepEqual(ref, { bucket: 'event-images', path: 'user/photo.jpg' });
});
