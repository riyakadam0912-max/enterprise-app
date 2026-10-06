import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatHoursDuration } from './time-format';

describe('formatHoursDuration', () => {
  it('formats decimal hours as hours and minutes', () => {
    assert.equal(formatHoursDuration(5.5), '5h 30m');
    assert.equal(formatHoursDuration(8), '8h');
    assert.equal(formatHoursDuration(0.5), '30m');
  });
});
