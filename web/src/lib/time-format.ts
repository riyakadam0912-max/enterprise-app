/**
 * Format time value to 12-hour format with AM/PM
 * @param value ISO string or null
 * @returns Formatted time string like "09:30 AM" or "—"
 */
export function formatTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format HH:MM time string to 12-hour format with AM/PM
 * @param time Time string in HH:MM format (24-hour)
 * @returns Formatted time string like "09:30 AM" or "—"
 */
export function formatShiftTime(time: string | null): string {
  if (!time) return '—';
  
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return time;
  }
}

/**
 * Format shift time range to 12-hour format
 * @param startTime Start time in HH:MM format
 * @param endTime End time in HH:MM format
 * @returns Formatted range like "09:00 AM - 05:00 PM"
 */
export function formatShiftRange(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return '—';
  return `${formatShiftTime(startTime)} - ${formatShiftTime(endTime)}`;
}
