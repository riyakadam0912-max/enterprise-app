'use client';

import { UserAvatar } from './UserAvatar';

type UserIdentityProps = {
  userId?: number | null;
  name?: string | null;
  subtitle?: string | null;
  size?: 'sm' | 'md';
  tone?: 'orange' | 'slate' | 'blue';
};

export function UserIdentity({ userId, name, subtitle, size = 'sm', tone = 'slate' }: UserIdentityProps) {
  const toneClass = tone === 'orange' ? 'bg-orange-100 text-orange-700' : tone === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-slate-900 text-white';

  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar userId={userId} name={name} size={size} className={toneClass} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{name || 'Unknown user'}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}
