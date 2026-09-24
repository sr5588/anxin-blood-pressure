import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyGreeting } from '../shared/greetings';
const at = (s: string) => Date.parse(s + 'T08:00:00+08:00');
test('greeting changes daily and by season', () => {
  assert.notEqual(dailyGreeting(at('2026-09-22')).quote, dailyGreeting(at('2026-09-23')).quote);
  assert.equal(dailyGreeting(at('2026-04-10')).season, 'spring');
  assert.equal(dailyGreeting(at('2026-07-10')).season, 'summer');
  assert.equal(dailyGreeting(at('2026-12-10')).season, 'winter');
});
test('holiday greeting takes priority; lunar date does not repeat in later years', () => {
  assert.match(dailyGreeting(at('2026-09-25')).quote, /月圆/);
  assert.doesNotMatch(dailyGreeting(at('2027-09-25')).quote, /月圆/);
  assert.match(dailyGreeting(at('2028-01-01')).quote, /新的一年/);
});
