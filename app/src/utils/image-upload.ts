export const MOBILE_IMAGE_TYPES = ['image/jpeg', 'image/png'] as const;
export const MOBILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type PickedImage = {
  uri: string;
  name: string;
  type: (typeof MOBILE_IMAGE_TYPES)[number];
  size?: number;
};

export function validatePickedImage(asset: { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null }, label: string): PickedImage {
  const type = (asset.mimeType ?? 'image/jpeg').toLowerCase();
  if (!MOBILE_IMAGE_TYPES.includes(type as (typeof MOBILE_IMAGE_TYPES)[number])) {
    throw new Error(`${label} must be a JPG, JPEG, or PNG image.`);
  }
  if (asset.fileSize != null && asset.fileSize > MOBILE_IMAGE_MAX_BYTES) {
    throw new Error(`${label} must be 5 MB or smaller.`);
  }
  const extension = type === 'image/png' ? 'png' : 'jpg';
  return {
    uri: asset.uri,
    name: asset.fileName || `${label.toLowerCase().replaceAll(' ', '-')}.${extension}`,
    type: type as PickedImage['type'],
    size: asset.fileSize ?? undefined,
  };
}