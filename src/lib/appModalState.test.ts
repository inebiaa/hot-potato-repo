import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAppModalState } from './appModalState.ts';

test('resolveAppModalState opens create-list modal from URL', () => {
  const state = resolveAppModalState('/', new URLSearchParams('modal=create-list'));
  assert.equal(state.isCreateListModalOpen, true);
  assert.equal(state.isAddEventModalOpen, false);
});

test('resolveAppModalState opens add-event modal from URL', () => {
  const state = resolveAppModalState('/', new URLSearchParams('modal=add-event'));
  assert.equal(state.isAddEventModalOpen, true);
  assert.equal(state.isAuthModalOpen, false);
  assert.equal(state.isTagRatingsModalOpen, false);
});

test('resolveAppModalState opens tag ratings modal off stats', () => {
  const state = resolveAppModalState(
    '/',
    new URLSearchParams('modal=tag&tagType=artist&tagValue=Charli%20XCX'),
  );
  assert.equal(state.isTagRatingsModalOpen, true);
  assert.deepEqual(state.tagRatingsData, { type: 'artist', value: 'Charli XCX' });
});

test('resolveAppModalState suppresses tag ratings modal on stats route', () => {
  const state = resolveAppModalState(
    '/stats',
    new URLSearchParams('modal=tag&tagType=artist&tagValue=Charli%20XCX'),
  );
  assert.equal(state.isTagRatingsModalOpen, false);
  assert.equal(state.tagRatingsData, null);
});

test('resolveAppModalState detects event card panel modals', () => {
  const state = resolveAppModalState(
    '/',
    new URLSearchParams('modal=view-ratings&targetEventId=abc'),
  );
  assert.equal(state.isEventPanelModal, true);
  assert.equal(state.isAddEventModalOpen, false);
});
