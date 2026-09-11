'use client';

import Image from 'next/image';
import { Camera, Eye, Loader2, X } from 'lucide-react';
import { ChangeEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getProfileAvatarUrl, uploadFile } from '@/api/filesApi';
import { ImageCropDialog } from '@/components/common/ImageCropDialog';
import { useAuthSession } from '@/stores/auth-store';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = ['image/png', 'image/jpeg'];

export type ProfileAvatarUploaderProps = {
  userName?: string | null;
  userEmail?: string | null;
  userId?: number | null;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onAvatarChange?: (nextUrl: string | null, fileId?: number | null) => void;
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
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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
      if (cancelled) {
        return;
      }
      const nextUrl = getProfileAvatarUrl(targetUserId);
      setCurrentAvatarUrl(nextUrl);
      onAvatarChange?.(nextUrl, null);
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

      const nextUrl = getProfileAvatarUrl(targetUserId);

      setCurrentAvatarUrl(nextUrl);
      onAvatarChange?.(nextUrl, null);
      return nextUrl;
    },
    [onAvatarChange],
  );

  const handleOpenPicker = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  const handleAvatarClick = useCallback(() => {
    if (currentAvatarUrl) {
      setIsPreviewOpen(true);
      return;
    }
    handleOpenPicker();
  }, [currentAvatarUrl, handleOpenPicker]);

  const handleAvatarKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleAvatarClick();
      }
    },
    [handleAvatarClick],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      setStatus(null);
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', 'users');
        formData.append('entityType', 'User');
        formData.append('entityId', String(resolvedUserId));
        formData.append('category', 'Profile Photo');
        formData.append('isPublic', 'false');
        const uploaded = await uploadFile(formData);
        const uploadedUrl = getProfileAvatarUrl(resolvedUserId as number);
        setCurrentAvatarUrl(uploadedUrl);
        onAvatarChange?.(uploadedUrl, uploaded.id);
        await refreshAvatarForCurrentUser(resolvedUserId as number);
        setStatus({ type: 'success', message: 'Profile photo uploaded successfully.' });
      } catch (uploadError) {
        const message = uploadError instanceof Error && uploadError.message ? uploadError.message : 'Failed to upload profile photo.';
        setStatus({ type: 'error', message });
      } finally {
        setIsUploading(false);
      }
    },
    [onAvatarChange, refreshAvatarForCurrentUser, resolvedUserId],
  );

  const handleAvatarChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      if (!file) {
        return;
      }

      const normalizedType = file.type.toLowerCase();
      const normalizedName = file.name.toLowerCase();
      const acceptedExtension = /\.(png|jpe?g)$/i.test(normalizedName);

      if (!ACCEPTED_AVATAR_TYPES.includes(normalizedType) && !acceptedExtension) {
        setStatus({
          type: 'error',
          message: 'Please choose a PNG, JPG, or JPEG image for your profile photo.',
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

      setCropFile(file);
      event.target.value = '';
    },
    [resolvedUserId],
  );

  return (
    <div className={`flex flex-col items-start gap-2 ${className}`}>
      <div
        className="relative inline-flex cursor-pointer"
        onClick={handleAvatarClick}
        onKeyDown={handleAvatarKeyDown}
        role="button"
        tabIndex={0}
        aria-label={currentAvatarUrl ? 'View profile photo' : 'Upload profile photo'}
        title={currentAvatarUrl ? 'View profile photo' : 'Upload profile photo'}
      >
        <div
          className={`group relative flex items-center justify-center overflow-hidden rounded-full bg-indigo-600 text-white shadow-md ring-2 ring-white ${sizeClasses}`}
        >
          {currentAvatarUrl ? (
            <Image src={currentAvatarUrl} alt="Profile avatar" fill className="object-cover" unoptimized onError={() => setCurrentAvatarUrl(null)} />
          ) : (
            <span className="font-bold leading-none">{initials}</span>
          )}

          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center bg-slate-900/40 group-hover:flex">
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Eye className="h-4 w-4 text-white" />
            )}
          </div>

          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          )}

          <button
            type="button"
            aria-label="Upload new profile photo"
            title="Upload new profile photo"
            onClick={(event) => {
              event.stopPropagation();
              handleOpenPicker();
            }}
            disabled={isUploading}
            className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-white shadow-md ring-2 ring-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        aria-label="Upload profile photo"
        onChange={handleAvatarChange}
      />

      {status && (
        <p className={`text-xs ${status.type === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {status.message}
        </p>
      )}
      {isPreviewOpen && currentAvatarUrl ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo preview"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="relative max-h-full max-w-3xl" onClick={(event) => event.stopPropagation()}>
            <Image
              src={currentAvatarUrl}
              alt="Profile avatar preview"
              width={720}
              height={720}
              className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl"
              unoptimized
            />
            <button
              type="button"
              aria-label="Close profile photo preview"
              title="Close preview"
              onClick={() => setIsPreviewOpen(false)}
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
      {cropFile ? <ImageCropDialog key={`${cropFile.name}-${cropFile.lastModified}`} file={cropFile} onCancel={() => setCropFile(null)} onCropped={(file) => { setCropFile(null); void uploadAvatar(file); }} /> : null}
    </div>
  );
}
