export function formatHoursDuration(value: number | null | undefined): string {
	if (value == null || Number.isNaN(value)) return '0h';

	const totalMinutes = Math.max(0, Math.round(value * 60));
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	if (hours === 0) return `${minutes}m`;
	if (minutes === 0) return `${hours}h`;
	return `${hours}h ${minutes}m`;
}