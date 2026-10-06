import { formatHoursDuration } from './time-format';

test('formats decimal hours as hours and minutes', () => {
	expect(formatHoursDuration(5.5)).toBe('5h 30m');
	expect(formatHoursDuration(8)).toBe('8h');
	expect(formatHoursDuration(0.5)).toBe('30m');
});