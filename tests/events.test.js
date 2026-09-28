import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTS, eventById, eventLabel } from '../src/core/events.js';

test('EVENTS: マルシェ・フード・ドリンクの3つ', () => {
  assert.deepEqual(EVENTS.map((e) => e.id), ['marche', 'food', 'drink']);
});

test('EVENTS: マルシェだけがカテゴリーを持つ', () => {
  assert.equal(eventById('marche').hasCategories, true);
  assert.equal(eventById('food').hasCategories, false);
  assert.equal(eventById('drink').hasCategories, false);
});

test('EVENTS: 祭りの2つは名前に（夏祭り）が付く', () => {
  assert.equal(eventById('food').name, 'フード（夏祭り）');
  assert.equal(eventById('drink').name, 'ドリンク（夏祭り）');
});

test('eventById: 知らないidならundefined', () => {
  assert.equal(eventById('unknown'), undefined);
  assert.equal(eventById(null), undefined);
});

test('eventLabel: アイコン付きの表示名を返す', () => {
  assert.equal(eventLabel('marche'), '🛍 マルシェ');
  assert.equal(eventLabel('food'), '🍔 フード（夏祭り）');
});

test('eventLabel: 知らないidならそのidをそのまま返す（画面が壊れない）', () => {
  assert.equal(eventLabel('unknown'), 'unknown');
  assert.equal(eventLabel(null), '');
});
