import assert from 'node:assert/strict';
import { test } from 'node:test';
import { eventCardImageUrl } from './eventCardImageUrl.ts';

test('empty / whitespace is undefined', () => {
  assert.equal(eventCardImageUrl(null), undefined);
  assert.equal(eventCardImageUrl(''), undefined);
  assert.equal(eventCardImageUrl('  '), undefined);
});

test('rewrites large Pinterest sizes down to 736w', () => {
  const src = 'https://i.pinimg.com/1200x/ab/cd/ef/photo.jpg';
  assert.equal(eventCardImageUrl(src), 'https://i.pinimg.com/736x/ab/cd/ef/photo.jpg');
});

test('leaves already-small Pinterest sizes alone', () => {
  const src = 'https://i.pinimg.com/736x/ab/cd/ef/photo.jpg';
  assert.equal(eventCardImageUrl(src), src);
});

test('rewrites Ticketmaster TABLET_LANDSCAPE_LARGE to mid size', () => {
  const src = 'https://s1.ticketm.net/dam/a/123_TABLET_LANDSCAPE_LARGE_16_9.jpg';
  assert.equal(
    eventCardImageUrl(src),
    'https://s1.ticketm.net/dam/a/123_TABLET_LANDSCAPE_16_9.jpg',
  );
});

test('caps Cloudflare image width', () => {
  const src = 'https://example.com/cdn-cgi/image/width=2400,quality=80/photo.jpg';
  assert.equal(
    eventCardImageUrl(src),
    'https://example.com/cdn-cgi/image/width=960,quality=80/photo.jpg',
  );
});

test('sets Shopify CDN width', () => {
  const src = 'https://cdn.shopify.com/s/files/1/photo.jpg';
  assert.equal(eventCardImageUrl(src), 'https://cdn.shopify.com/s/files/1/photo.jpg?width=960');
});

test('passes through Supabase storage URLs unchanged', () => {
  const src =
    'https://uhljagzmwnsqpkasqfyn.supabase.co/storage/v1/object/public/event-images/user/photo.jpg';
  assert.equal(eventCardImageUrl(src), src);
});

test('rewrites CDN event photos to the .card. sibling', () => {
  const src = 'https://images.secretblogger.app/event/user/photo.jpg';
  assert.equal(eventCardImageUrl(src), 'https://images.secretblogger.app/event/user/photo.card.jpg');
});

test('leaves CDN card URLs and non-event CDN photos alone', () => {
  assert.equal(
    eventCardImageUrl('https://images.secretblogger.app/event/user/photo.card.jpg'),
    'https://images.secretblogger.app/event/user/photo.card.jpg',
  );
  const profile = 'https://images.secretblogger.app/profile/user/avatar.jpg';
  assert.equal(eventCardImageUrl(profile), profile);
});
