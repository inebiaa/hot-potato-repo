import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isEventCardInteractiveTarget,
  shouldOpenShowFromCardBodyClick,
} from './eventCardBodyClick.ts';

type MockNode = {
  tagName: string;
  attrs: Set<string>;
  parent: MockNode | null;
};

function mockClosest(node: MockNode, selector: string): MockNode | null {
  let cur: MockNode | null = node;
  while (cur) {
    if (selector === 'button' && cur.tagName === 'BUTTON') return cur;
    if (selector === 'a' && cur.tagName === 'A') return cur;
    if (selector === '[role="button"]' && cur.attrs.has('role')) return cur;
    if (selector === '[data-event-actions]' && cur.attrs.has('data-event-actions')) return cur;
    if (selector === '[data-tag-pill]' && cur.attrs.has('data-tag-pill')) return cur;
    cur = cur.parent;
  }
  return null;
}

function asTarget(node: MockNode): EventTarget {
  return {
    closest: (selector: string) => mockClosest(node, selector) as unknown as Element | null,
  } as unknown as EventTarget;
}

function node(
  tagName: string,
  attrs: string[] = [],
  parent: MockNode | null = null,
): MockNode {
  const n: MockNode = { tagName, attrs: new Set(attrs), parent };
  return n;
}

test('card body text opens show', () => {
  const card = node('DIV');
  const body = node('P', [], card);
  const text = node('SPAN', [], body);
  assert.equal(shouldOpenShowFromCardBodyClick(asTarget(text)), true);
  assert.equal(isEventCardInteractiveTarget(asTarget(text)), false);
});

test('tag pill click does not open show', () => {
  const card = node('DIV');
  const pill = node('BUTTON', ['data-tag-pill'], card);
  const label = node('SPAN', [], pill);
  assert.equal(shouldOpenShowFromCardBodyClick(asTarget(label)), false);
});

test('heart / menu actions do not open show', () => {
  const card = node('DIV');
  const actions = node('DIV', ['data-event-actions'], card);
  const heart = node('BUTTON', [], actions);
  assert.equal(shouldOpenShowFromCardBodyClick(asTarget(heart)), false);
});

test('title control opens via its own handler, not card body routing', () => {
  const card = node('DIV');
  const title = node('H3', ['role'], card);
  const text = node('SPAN', [], title);
  assert.equal(shouldOpenShowFromCardBodyClick(asTarget(text)), false);
});

test('view ratings row does not open show', () => {
  const card = node('DIV');
  const ratingsBtn = node('BUTTON', [], card);
  assert.equal(shouldOpenShowFromCardBodyClick(asTarget(ratingsBtn)), false);
});

test('links do not open show from card body', () => {
  const card = node('DIV');
  const link = node('A', [], card);
  assert.equal(shouldOpenShowFromCardBodyClick(asTarget(link)), false);
});

test('null / non-element targets are safe', () => {
  assert.equal(shouldOpenShowFromCardBodyClick(null), true);
  assert.equal(isEventCardInteractiveTarget(null), false);
  assert.equal(shouldOpenShowFromCardBodyClick({} as EventTarget), true);
});
