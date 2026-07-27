export const TASK_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  REJECTED: ['IN_PROGRESS', 'SUBMITTED'],
  APPROVED: [],
};

export const ROLE_ALLOWED_TRANSITIONS: Record<
  string,
  Record<string, string[]>
> = {
  EMPLOYEE: {
    PENDING: ['IN_PROGRESS'],
    IN_PROGRESS: ['SUBMITTED'],
    REJECTED: ['IN_PROGRESS', 'SUBMITTED'],
  },
  MANAGER: {
    SUBMITTED: ['APPROVED', 'REJECTED'],
    PENDING: ['IN_PROGRESS'],
    IN_PROGRESS: ['SUBMITTED'],
  },
  ADMIN: {
    PENDING: ['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REJECTED'],
    IN_PROGRESS: ['PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED'],
    SUBMITTED: ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'],
    REJECTED: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED'],
    APPROVED: ['PENDING', 'IN_PROGRESS', 'SUBMITTED', 'REJECTED'],
  },
};

export function canTransition(from: string, to: string, role: string): boolean {
  const allowed = ROLE_ALLOWED_TRANSITIONS[role]?.[from] ?? [];
  return allowed.includes(to);
}

export function getAllowedTransitions(
  currentStatus: string,
  role: string,
): string[] {
  return ROLE_ALLOWED_TRANSITIONS[role]?.[currentStatus] ?? [];
}

export function validateTransition(
  from: string,
  to: string,
  role: string,
): void {
  if (!canTransition(from, to, role)) {
    throw new Error(
      `Role ${role} cannot transition task from ${from} to ${to}`,
    );
  }
}
