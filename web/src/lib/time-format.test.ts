import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatHoursDuration } from './time-format';

describe('formatHoursDuration', () => {
  it('formats decimal hours as hours and minutes', () => {
    assert.equal(formatHoursDuration(5.5), '5:30');
    assert.equal(formatHoursDuration(8), '8:00');
    assert.equal(formatHoursDuration(0.5), '0:30');
  });
});
