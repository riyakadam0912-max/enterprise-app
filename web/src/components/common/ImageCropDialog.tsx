'use client';

import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';

type ImageCropDialogProps = {
  file: File;
  onCancel: () => void;
  onCropped: (file: File) => void;
};

function createImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function cropFile(file: File, area: Area) {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await createImage(sourceUrl);
    const canvas = document.createElement('canvas');
    canvas.width = area.width;
    canvas.height = area.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare the cropped image.');
    context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Unable to create the cropped image.');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function ImageCropDialog({ file, onCancel, onCropped }: ImageCropDialogProps) {
  const [imageUrl] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const handleCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
    setArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!area) return;
    setSaving(true);
    setError('');
    try {
      onCropped(await cropFile(file, area));
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to crop this image.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Crop image">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-900">Crop image</h2>
        <div className="relative mt-4 h-72 overflow-hidden rounded-xl bg-slate-950">
          <Cropper image={imageUrl} crop={crop} zoom={zoom} aspect={4 / 3} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={handleCropComplete} />
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Zoom
          <input className="mt-2 w-full" type="range" min={1} max={3} step={0.1} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancel</button>
          <button type="button" onClick={() => void handleConfirm()} disabled={!area || saving} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{saving ? 'Preparing...' : 'Use image'}</button>
        </div>
      </div>
    </div>
  );
}
