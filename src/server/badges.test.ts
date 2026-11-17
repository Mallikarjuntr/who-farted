import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeFor, nextBadge } from '../shared/badges.ts';

void test('streak badges climb through the titles', () => {
  assert.equal(badgeFor(0).text, 'Sniffer');
  assert.equal(badgeFor(1).text, 'Rookie Sniffer · 1-day streak');
  assert.equal(badgeFor(3).title, 'Detective');
  assert.equal(badgeFor(7).title, 'Senior Sniffer');
  assert.equal(badgeFor(14).title, 'Chief Inspector');
  assert.equal(badgeFor(45).title, 'Legendary Nose');
});

void test('the next badge says how many days are left', () => {
  assert.deepEqual(nextBadge(0), { title: 'Rookie Sniffer', daysToGo: 1 });
  assert.deepEqual(nextBadge(5), { title: 'Senior Sniffer', daysToGo: 2 });
  assert.equal(nextBadge(30), null);
});

void test('flair text stays short and has no commas', () => {
  for (const days of [0, 1, 3, 7, 14, 30, 365]) {
    const { text } = badgeFor(days);
    assert.ok(text.length <= 64, text);
    assert.ok(!text.includes(','), text);
  }
});
