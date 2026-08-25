import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareEventsForFeed, mergeEventsByFeedOrder } from './eventsFeedOrder.ts';

const NOW = new Date('2026-06-15T12:00:00');

test('compareEventsForFeed puts upcoming before past', () => {
  const upcoming = { id: 'a', date: '2026-07-01' };
  const past = { id: 'b', date: '2026-05-01' };
  assert.equal(compareEventsForFeed(upcoming, past, NOW) < 0, true);
  assert.equal(compareEventsForFeed(past, upcoming, NOW) > 0, true);
});

test('compareEventsForFeed sorts upcoming soonest first', () => {
  const sooner = { id: 'a', date: '2026-07-01' };
  const later = { id: 'b', date: '2026-08-01' };
  assert.equal(compareEventsForFeed(sooner, later, NOW) < 0, true);
});

test('compareEventsForFeed sorts past newest first', () => {
  const newer = { id: 'a', date: '2026-05-10' };
  const older = { id: 'b', date: '2026-04-01' };
  assert.equal(compareEventsForFeed(newer, older, NOW) < 0, true);
});

test('mergeEventsByFeedOrder dedupes by id and keeps feed order', () => {
  const existing = [
    { id: 'up1', date: '2026-07-01' },
    { id: 'past1', date: '2026-05-01' },
  ];
  const incoming = [
    { id: 'up1', date: '2026-07-15' },
    { id: 'up2', date: '2026-06-20' },
  ];
  const merged = mergeEventsByFeedOrder(existing, incoming, NOW);
  assert.deepEqual(
    merged.map((e) => e.id),
    ['up2', 'up1', 'past1'],
  );
  assert.equal(merged.find((e) => e.id === 'up1')?.date, '2026-07-15');
});
