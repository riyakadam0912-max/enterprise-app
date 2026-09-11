'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { getProfileAvatarInfo, getProfileAvatarUrl } from '@/api/filesApi';
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
  const [hasAvatar, setHasAvatar] = useState<boolean | null>(fileId ? true : null);
  const sizeClass = size === 'lg' ? 'h-24 w-24 text-2xl' : size === 'md' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs';
  const imageUrl = userId && hasAvatar
    ? getProfileAvatarUrl(userId)
    : resolvedFileId
      ? `/api/v1/files/preview/${resolvedFileId}`
      : null;

  useEffect(() => {
    setResolvedFileId(fileId ?? null);
    setHasAvatar(fileId ? true : userId ? null : false);
  }, [fileId, userId]);

  useEffect(() => {
    if (!userId || attemptedUserIdRef.current === userId) {
      return;
    }

    attemptedUserIdRef.current = userId;
    let cancelled = false;
    void getProfileAvatarInfo(userId)
      .then((info) => {
        if (cancelled) {
          return;
        }
        const nextFileId = info.fileId;
        setHasAvatar(info.exists);
        setResolvedFileId(nextFileId);
        const currentSession = getAuthSessionSnapshot();
        if (userId === currentSession.user?.id && currentSession.avatarFileId !== nextFileId) {
          setAuthSession({ ...currentSession, avatarFileId: nextFileId });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasAvatar(false);
          setResolvedFileId(null);
        }
      });

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
          onError={() => {
            setHasAvatar(false);
            setResolvedFileId(null);
          }}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
