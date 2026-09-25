import { MOBILE_IMAGE_MAX_BYTES, validatePickedImage } from './image-upload';

test('normalizes a valid picker image', () => {
  expect(validatePickedImage({ uri: 'file:///receipt.png', mimeType: 'image/png', fileSize: 100, fileName: 'receipt.png' }, 'Receipt')).toEqual({
    uri: 'file:///receipt.png',
    name: 'receipt.png',
    type: 'image/png',
    size: 100,
  });
});

test('rejects unsupported and oversized picker images', () => {
  expect(() => validatePickedImage({ uri: 'file:///receipt.gif', mimeType: 'image/gif' }, 'Receipt')).toThrow('JPG, JPEG, or PNG');
  expect(() => validatePickedImage({ uri: 'file:///receipt.jpg', mimeType: 'image/jpeg', fileSize: MOBILE_IMAGE_MAX_BYTES + 1 }, 'Receipt')).toThrow('5 MB');
});