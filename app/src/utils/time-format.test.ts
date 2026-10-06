import { formatHoursDuration } from './time-format';

test('formats decimal hours as hours and minutes', () => {
	expect(formatHoursDuration(5.5)).toBe('5:30');
	expect(formatHoursDuration(8)).toBe('8:00');
	expect(formatHoursDuration(0.5)).toBe('0:30');
});