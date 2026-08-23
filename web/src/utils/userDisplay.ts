export type UserLike = {
  name?: string | null;
  fullName?: string | null;
  designation?: string | null;
  jobTitle?: string | null;
  position?: string | null;
  role?: string | null;
};

export type UserDisplay = {
  primary: string;
  subtitle: string;
};

export function resolveDesignation(user: UserLike | null | undefined): string {
  if (!user) return '';
  return (
    (user.designation?.length ?? 0) > 0
      ? user.designation
      : (user.jobTitle?.length ?? 0) > 0
        ? user.jobTitle
        : (user.position?.length ?? 0) > 0
          ? user.position
          : null
  ) ?? '';
}

export function formatUserDisplay(
  user: UserLike | null | undefined,
): UserDisplay {
  const primary =
    (user?.name?.trim()?.length ?? 0) > 0
      ? user!.name!.trim()
      : (user?.fullName?.trim()?.length ?? 0) > 0
        ? user!.fullName!.trim()
        : 'Unknown User';
  const designation = resolveDesignation(user);
  const subtitle =
    designation || ((user?.role?.length ?? 0) > 0 ? String(user!.role!) : '');
  return { primary, subtitle };
}

export function formatUserFullLabel(
  user: UserLike | null | undefined,
  separator: string = ' — ',
): string {
  const { primary, subtitle } = formatUserDisplay(user);
  return subtitle ? `${primary}${separator}${subtitle}` : primary;
}
