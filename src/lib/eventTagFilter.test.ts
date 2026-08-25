import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterEventsBySelectedTags, type SelectedTagFilter } from './eventTagFilter.ts';
import type { Event } from './eventTypes.ts';

function stubEvent(partial: Partial<Event> & Pick<Event, 'id' | 'name'>): Event {
  return {
    date: '2026-06-01',
    city: 'Denver, CO',
    season: 'Summer 2026',
    show_type: 'music',
    location: 'Red Rocks',
    formatted_address: null,
    image_url: null,
    countdown_link: null,
    producers: null,
    featured_designers: null,
    featured_artists: null,
    hair_makeup: null,
    header_tags: null,
    footer_tags: null,
    custom_tags: null,
    custom_tag_meta: null,
    created_by: null,
    created_at: '2026-01-01',
    ...partial,
  };
}

test('filterEventsBySelectedTags returns all when no filters', () => {
  const events = [stubEvent({ id: '1', name: 'A' }), stubEvent({ id: '2', name: 'B' })];
  assert.equal(filterEventsBySelectedTags(events, [], null).length, 2);
});

test('filterEventsBySelectedTags matches city filter', () => {
  const events = [
    stubEvent({ id: '1', name: 'A', city: 'Denver, CO' }),
    stubEvent({ id: '2', name: 'B', city: 'Austin, TX' }),
  ];
  const tags: SelectedTagFilter[] = [{ type: 'city', value: 'Denver, CO', label: 'Denver, CO' }];
  const filtered = filterEventsBySelectedTags(events, tags, null);
  assert.deepEqual(filtered.map((e) => e.id), ['1']);
});

test('filterEventsBySelectedTags requires every selected tag (AND)', () => {
  const events = [
    stubEvent({
      id: '1',
      name: 'A',
      city: 'Denver, CO',
      featured_artists: ['Charli XCX'],
    }),
    stubEvent({
      id: '2',
      name: 'B',
      city: 'Denver, CO',
      featured_artists: ['SOMBR'],
    }),
  ];
  const tags: SelectedTagFilter[] = [
    { type: 'city', value: 'Denver, CO', label: 'Denver, CO' },
    { type: 'artist', value: 'Charli XCX', label: 'Charli XCX' },
  ];
  const filtered = filterEventsBySelectedTags(events, tags, null);
  assert.deepEqual(filtered.map((e) => e.id), ['1']);
});
