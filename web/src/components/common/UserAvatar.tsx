'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { listFilesByEntity } from '@/api/filesApi';
import { getAuthSessionSnapshot, setAuthSession, useAuthSession } from '@/stores/auth-store';

type UserAvatarProps = {
  userId?: number | null;
  name?: string | null;
  fileId?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
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

export function UserAvatar({
  userId,
  name,
  fileId,
  size = 'sm',
  className = '',
}: UserAvatarProps) {
  const session = useAuthSession();
  const attemptedUserIdRef = useRef<number | null>(null);
  const [resolvedFileId, setResolvedFileId] = useState<number | null>(fileId ?? null);
  const sizeClass = size === 'lg' ? 'h-24 w-24 text-2xl' : size === 'md' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs';
  const imageUrl = resolvedFileId ? `/api/v1/files/preview/${resolvedFileId}` : null;

  useEffect(() => {
    setResolvedFileId(fileId ?? null);
  }, [fileId]);

  useEffect(() => {
    if (fileId || !userId || attemptedUserIdRef.current === userId) {
      return;
    }

    attemptedUserIdRef.current = userId;
    let cancelled = false;
    void listFilesByEntity('User', userId)
      .then((files) => {
        if (cancelled) {
          return;
        }
        const avatar = files.find((file) => file.category === 'Profile Photo');
        const nextFileId = avatar?.id ?? null;
        setResolvedFileId(nextFileId);
        const currentSession = getAuthSessionSnapshot();
        if (userId === currentSession.user?.id && currentSession.avatarFileId !== nextFileId) {
          setAuthSession({ ...currentSession, avatarFileId: nextFileId });
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [fileId, session.user?.id, userId]);

  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-500 font-semibold text-white ${sizeClass} ${className}`}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={name ? `${name} avatar` : 'User avatar'}
          fill
          className="object-cover"
          unoptimized
          onError={() => setResolvedFileId(null)}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
