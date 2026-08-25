import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  headerActiveView,
  headerSearchOpensHome,
  isHomeCatalogRoute,
  isListPageRoute,
  isProfilePageRoute,
  isSettingsRoute,
  isStatsRoute,
} from './homeCatalogRoute.ts';

test('isHomeCatalogRoute is true for home and event overlay URLs', () => {
  assert.equal(isHomeCatalogRoute('/'), true);
  assert.equal(isHomeCatalogRoute('/event/abc'), true);
});

test('isHomeCatalogRoute is false for other pages', () => {
  assert.equal(isHomeCatalogRoute('/stats'), false);
  assert.equal(isHomeCatalogRoute('/settings'), false);
  assert.equal(isHomeCatalogRoute('/profile'), false);
  assert.equal(isHomeCatalogRoute('/somehandle'), false);
  assert.equal(isHomeCatalogRoute('/somehandle/list/1'), false);
});

test('isSettingsRoute matches settings URLs only', () => {
  assert.equal(isSettingsRoute('/settings'), true);
  assert.equal(isSettingsRoute('/settings/'), true);
  assert.equal(isSettingsRoute('/'), false);
  assert.equal(isSettingsRoute('/stats'), false);
  assert.equal(isSettingsRoute('/profile'), false);
});

test('isStatsRoute and isProfilePageRoute', () => {
  assert.equal(isStatsRoute('/stats'), true);
  assert.equal(isProfilePageRoute('/profile'), true);
  assert.equal(isProfilePageRoute('/somehandle'), true);
  assert.equal(isProfilePageRoute('/somehandle/list/1'), false);
  assert.equal(isProfilePageRoute('/settings'), false);
  assert.equal(isProfilePageRoute('/stats'), false);
});

test('headerActiveView matches the current page', () => {
  assert.equal(headerActiveView('/'), 'home');
  assert.equal(headerActiveView('/event/abc'), 'home');
  assert.equal(headerActiveView('/settings'), 'settings');
  assert.equal(headerActiveView('/stats'), 'stats');
  assert.equal(headerActiveView('/profile'), 'profile');
  assert.equal(headerActiveView('/somehandle'), 'profile');
  assert.equal(headerActiveView('/somehandle/list/1'), 'profile');
});

test('header search opens home except on stats, profile, and lists', () => {
  assert.equal(headerSearchOpensHome('/'), false);
  assert.equal(headerSearchOpensHome('/event/abc'), false);
  assert.equal(headerSearchOpensHome('/stats'), false);
  assert.equal(headerSearchOpensHome('/profile'), false);
  assert.equal(headerSearchOpensHome('/somehandle'), false);
  assert.equal(headerSearchOpensHome('/settings'), true);
  assert.equal(isListPageRoute('/somehandle/list/1'), true);
  assert.equal(isListPageRoute('/list/1'), true);
  assert.equal(headerSearchOpensHome('/somehandle/list/1'), false);
  assert.equal(headerSearchOpensHome('/list/1'), false);
});
