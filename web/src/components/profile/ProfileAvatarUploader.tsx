'use client';

import Image from 'next/image';
import { Camera, Loader2 } from 'lucide-react';
import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { listFilesByEntity, uploadFile } from '@/api/filesApi';
import { useAuthSession } from '@/stores/auth-store';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export type ProfileAvatarUploaderProps = {
  userName?: string | null;
  userEmail?: string | null;
  userId?: number | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onAvatarChange?: (nextUrl: string | null) => void;
};

function getInitials(name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) {
    return 'U';
  }

  return normalized.charAt(0).toUpperCase();
}

export function ProfileAvatarUploader({
  userName,
  userEmail,
  userId,
  avatarUrl,
  size = 'lg',
  className = '',
  onAvatarChange,
}: ProfileAvatarUploaderProps) {
  const session = useAuthSession();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState<string | null>(avatarUrl ?? null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const resolvedUserId = userId ?? session.user?.id ?? null;

  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl ?? null);
  }, [avatarUrl]);

  useEffect(() => {
    if (avatarUrl || !resolvedUserId) {
      return;
    }

    const targetUserId = resolvedUserId;
    let cancelled = false;

    async function loadCurrentAvatar() {
      try {
        const files = await listFilesByEntity('User', targetUserId);
        if (cancelled) {
          return;
        }
        const preferredAvatar = files.find((file) => file.category === 'Profile Photo') ?? files[0];
        const nextUrl = preferredAvatar?.url || preferredAvatar?.downloadUrl || preferredAvatar?.previewUrl || null;
        setCurrentAvatarUrl(nextUrl);
        onAvatarChange?.(nextUrl);
      } catch {
        // ignore missing avatar state; initials fallback is the expected UX
      }
    }

    loadCurrentAvatar();
    return () => {
      cancelled = true;
    };
  }, [avatarUrl, onAvatarChange, resolvedUserId]);

  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'sm':
        return 'h-12 w-12 text-lg';
      case 'md':
        return 'h-16 w-16 text-xl';
      case 'lg':
      default:
        return 'h-24 w-24 text-2xl';
    }
  }, [size]);

  const initials = useMemo(
    () => getInitials(userName ?? session.user?.name ?? userEmail ?? 'User'),
    [session.user?.name, userEmail, userName],
  );

  const refreshAvatarForCurrentUser = useCallback(
    async (targetUserId: number) => {
      if (!targetUserId) {
        return null;
      }

      const files = await listFilesByEntity('User', targetUserId);
      const preferredAvatar = files.find((file) => file.category === 'Profile Photo') ?? files[0];
      const nextUrl = preferredAvatar?.url || preferredAvatar?.downloadUrl || preferredAvatar?.previewUrl || null;

      setCurrentAvatarUrl(nextUrl);
      onAvatarChange?.(nextUrl);
      return nextUrl;
    },
    [onAvatarChange],
  );

  const handleOpenPicker = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  const handleAvatarKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleOpenPicker();
      }
    },
    [handleOpenPicker],
  );

  const handleAvatarChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        return;
      }

      const normalizedType = file.type.toLowerCase();
      const normalizedName = file.name.toLowerCase();
      const acceptedExtension = /\.(png|jpe?g|webp)$/i.test(normalizedName);

      if (!ACCEPTED_AVATAR_TYPES.includes(normalizedType) && !acceptedExtension) {
        setStatus({
          type: 'error',
          message: 'Please choose a PNG, JPG, or WebP image for your profile photo.',
        });
        event.target.value = '';
        return;
      }

      if (file.size > MAX_AVATAR_SIZE_BYTES) {
        setStatus({
          type: 'error',
          message: 'Profile photo must be 5 MB or smaller.',
        });
        event.target.value = '';
        return;
      }

      if (!resolvedUserId) {
        setStatus({
          type: 'error',
          message: 'Unable to upload a profile photo because your user is not available right now.',
        });
        event.target.value = '';
        return;
      }

      setStatus(null);
      setIsUploading(true);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', 'users');
        formData.append('entityType', 'User');
        formData.append('entityId', String(resolvedUserId));
        formData.append('category', 'Profile Photo');
        formData.append('isPublic', 'true');

        const uploaded = await uploadFile(formData);
        const uploadedUrl = uploaded.url || uploaded.downloadUrl || uploaded.previewUrl || null;

        setCurrentAvatarUrl(uploadedUrl);
        onAvatarChange?.(uploadedUrl);
        await refreshAvatarForCurrentUser(resolvedUserId);
        setStatus({ type: 'success', message: 'Profile photo uploaded successfully.' });
      } catch (uploadError) {
        const message =
          uploadError instanceof Error && uploadError.message
            ? uploadError.message
            : 'Failed to upload profile photo.';
        setStatus({ type: 'error', message });
      } finally {
        setIsUploading(false);
        event.target.value = '';
      }
    },
    [onAvatarChange, refreshAvatarForCurrentUser, resolvedUserId],
  );

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <div
        className="relative inline-flex cursor-pointer"
        onClick={handleOpenPicker}
        onKeyDown={handleAvatarKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Upload profile photo"
        title="Upload profile photo"
      >
        <div
          className={`group relative flex items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-white shadow-md ring-2 ring-white ${sizeClasses}`}
        >
          {currentAvatarUrl ? (
            <Image src={currentAvatarUrl} alt="Profile avatar" fill className="object-cover" unoptimized />
          ) : (
            <span className="font-bold leading-none">{initials}</span>
          )}

          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-slate-900/40 group-hover:flex">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Camera className="h-4 w-4 text-white" />
            )}
          </div>

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Upload profile photo"
        onChange={handleAvatarChange}
      />

      {status && (
        <p className={`text-xs ${status.type === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {status.message}
        </p>
      )}
    </div>
  );
}
