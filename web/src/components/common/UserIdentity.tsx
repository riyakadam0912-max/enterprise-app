'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getManagedFileUrl, listFilesByEntity } from '@/api/filesApi';

type UserIdentityProps = {
  userId?: number | null;
  name?: string | null;
  subtitle?: string | null;
  size?: 'sm' | 'md';
  tone?: 'orange' | 'slate' | 'blue';
};

function initials(name?: string | null) {
  return (name ?? 'User')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';
}

export function UserIdentity({ userId, name, subtitle, size = 'sm', tone = 'slate' }: UserIdentityProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const dimension = size === 'md' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs';
  const background = tone === 'orange' ? 'bg-orange-100 text-orange-700' : tone === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-slate-900 text-white';

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void listFilesByEntity('User', userId).then((files) => {
      if (cancelled) return;
      const avatar = files.find((file) => file.category === 'Profile Photo');
      setImageUrl(avatar ? getManagedFileUrl(avatar) : null);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ${background} ${dimension}`}>
        {imageUrl ? <Image src={imageUrl} alt="" width={size === 'md' ? 44 : 32} height={size === 'md' ? 44 : 32} className="h-full w-full object-cover" unoptimized onError={() => setImageUrl(null)} /> : initials(name)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">{name || 'Unknown user'}</p>
        {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}
