import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearAppModalParams,
  parseAppModal,
  setAppModalParams,
} from './searchParamsModal.ts';

test('parseAppModal reads known modal kinds', () => {
  const params = new URLSearchParams('modal=auth&authMode=signup&authPrompt=hello');
  const parsed = parseAppModal(params);
  assert.equal(parsed.modal, 'auth');
  assert.equal(parsed.authMode, 'signup');
  assert.equal(parsed.authPrompt, 'hello');
});

test('parseAppModal ignores unknown modal values', () => {
  const params = new URLSearchParams('modal=settings');
  assert.equal(parseAppModal(params).modal, null);
});

test('setAppModalParams replaces prior modal keys', () => {
  const current = new URLSearchParams('modal=auth&authMode=signin&stats=1');
  const next = setAppModalParams(current, 'tag', { tagType: 'artist', tagValue: 'abc' });
  const parsed = new URLSearchParams(next);
  assert.equal(parsed.get('modal'), 'tag');
  assert.equal(parsed.get('tagType'), 'artist');
  assert.equal(parsed.get('tagValue'), 'abc');
  assert.equal(parsed.get('authMode'), null);
  assert.equal(parsed.get('stats'), '1');
});

test('clearAppModalParams keeps non-modal keys', () => {
  const current = new URLSearchParams('modal=rate&targetEventId=x&embed=1');
  const next = clearAppModalParams(current);
  const parsed = new URLSearchParams(next);
  assert.equal(parsed.get('modal'), null);
  assert.equal(parsed.get('targetEventId'), null);
  assert.equal(parsed.get('embed'), '1');
});
