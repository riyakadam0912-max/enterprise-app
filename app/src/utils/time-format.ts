export function formatHoursDuration(value: number | null | undefined): string {
	if (value == null || Number.isNaN(value)) return '0:00';

	const totalMinutes = Math.max(0, Math.round(value * 60));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	return `${hours}:${String(minutes).padStart(2, '0')}`;
}