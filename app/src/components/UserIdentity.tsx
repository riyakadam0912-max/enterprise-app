import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { filesByEntity, type ManagedFile } from '@/src/api/files';

type UserIdentityProps = {
  userId?: number | null;
  name?: string | null;
  subtitle?: string | null;
  size?: 'sm' | 'md';
  showLabel?: boolean;
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

function normalizeCategory(raw?: string | null) {
  return String(raw ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function UserIdentity({ userId, name, subtitle, size = 'sm', showLabel = true }: UserIdentityProps) {
  const [avatar, setAvatar] = useState<ManagedFile | null>(null);
  const dimension = size === 'md' ? 44 : 34;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    void filesByEntity('User', userId)
      .then((files) => {
        if (cancelled) return;
        const normalized = files.find((file) => {
          const category = normalizeCategory(file.category);
          return category === 'profile photo' || category === 'profilephoto';
        });
        setAvatar(normalized ?? null);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const imageUri = avatar?.signedDownloadUrl ?? avatar?.previewUrl ?? avatar?.downloadUrl ?? null;
  const avatarView = (
    <View
      style={{
        width: dimension,
        height: dimension,
        borderRadius: dimension / 2,
        backgroundColor: '#e2e8f0',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {imageUri ? (
        <Image
          testID="user-avatar-image"
          source={{ uri: imageUri }}
          style={{ width: dimension, height: dimension }}
        />
      ) : (
        <Text style={{ color: '#334155', fontWeight: '800', fontSize: size === 'md' ? 14 : 12 }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );

  if (!showLabel) return avatarView;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {avatarView}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: '#172033', fontWeight: '800' }}>
          {name || 'Unknown user'}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
