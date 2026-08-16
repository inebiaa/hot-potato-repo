import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedImageAttrs } from './feedImageAttrs.ts';

test('priority cards load immediately', () => {
  assert.deepEqual(feedImageAttrs(true), {
    loading: 'eager',
    fetchPriority: 'high',
    decoding: 'async',
    referrerPolicy: 'no-referrer',
  });
});

test('offscreen cards stay lazy and omit a Referer (hotlink-safe)', () => {
  assert.deepEqual(feedImageAttrs(false), {
    loading: 'lazy',
    fetchPriority: 'auto',
    decoding: 'async',
    referrerPolicy: 'no-referrer',
  });
});
