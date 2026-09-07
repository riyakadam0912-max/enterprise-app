import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { filesByEntity, type ManagedFile } from '@/src/api/files';

type UserIdentityProps = {
  userId?: number | null;
  name?: string | null;
  subtitle?: string | null;
  size?: 'sm' | 'md';
};

function initials(name?: string | null) {
  return (name ?? 'User').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'U';
}

export function UserIdentity({ userId, name, subtitle, size = 'sm' }: UserIdentityProps) {
  const [avatar, setAvatar] = useState<ManagedFile | null>(null);
  const dimension = size === 'md' ? 44 : 34;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void filesByEntity('User', userId).then((files) => {
      if (!cancelled) setAvatar(files.find((file) => file.category === 'Profile Photo') ?? null);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId]);
  const imageUri = avatar?.signedDownloadUrl ?? avatar?.previewUrl ?? null;
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
    <View style={{ width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {imageUri ? <Image source={{ uri: imageUri }} style={{ width: dimension, height: dimension }} /> : <Text style={{ color: '#334155', fontWeight: '800', fontSize: size === 'md' ? 14 : 12 }}>{initials(name)}</Text>}
    </View>
    <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: '#172033', fontWeight: '800' }}>{name || 'Unknown user'}</Text>{subtitle ? <Text numberOfLines={1} style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{subtitle}</Text> : null}</View>
  </View>;
}
