/** Refresh saved attendance changes without turning a read failure into a mutation failure. */
export async function refreshAttendanceViews({
  shared,
  personalEnabled,
  personal,
}: {
  shared: Array<() => Promise<unknown>>;
  personalEnabled: boolean;
  personal: Array<() => Promise<unknown>>;
}): Promise<boolean> {
  const tasks = [...shared, ...(personalEnabled ? personal : [])];
  const results = await Promise.allSettled(tasks.map(task => Promise.resolve().then(task)));
  return results.every(result => result.status === 'fulfilled');
}
