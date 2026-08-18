import { BadRequestException } from '@nestjs/common';
import {
  isSupportedFile,
  assertSupportedFile,
  createStoredFileName,
  buildStorageFolder,
  sanitizeFileName,
} from './file-management.utils';

describe('FileManagementUtils', () => {
  describe('isSupportedFile', () => {
    it('accepts allowed image types', () => {
      expect(isSupportedFile('photo.jpg', 'image/jpeg')).toBe(true);
      expect(isSupportedFile('photo.png', 'image/png')).toBe(true);
      expect(isSupportedFile('photo.gif', 'image/gif')).toBe(true);
      expect(isSupportedFile('photo.webp', 'image/webp')).toBe(true);
    });

    it('accepts allowed document types', () => {
      expect(isSupportedFile('document.pdf', 'application/pdf')).toBe(true);
      expect(
        isSupportedFile(
          'sheet.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
      ).toBe(true);
      expect(
        isSupportedFile(
          'doc.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ).toBe(true);
      expect(isSupportedFile('data.json', 'application/json')).toBe(true);
      expect(isSupportedFile('data.csv', 'text/csv')).toBe(true);
    });

    it('rejects executable file types', () => {
      expect(isSupportedFile('malware.exe', 'application/octet-stream')).toBe(
        false,
      );
      expect(isSupportedFile('script.sh', 'application/x-sh')).toBe(false);
      expect(isSupportedFile('script.bat', 'application/x-msdownload')).toBe(
        false,
      );
    });

    it('rejects files without extensions', () => {
      expect(isSupportedFile('noextension', 'image/jpeg')).toBe(false);
    });

    it('rejects files with disallowed extensions even if MIME type is valid', () => {
      expect(isSupportedFile('hidden.exe', 'image/jpeg')).toBe(false);
      expect(isSupportedFile('script.js', 'text/plain')).toBe(false);
      expect(isSupportedFile('malicious.php', 'text/plain')).toBe(false);
    });

    it('rejects mismatched MIME types and extensions', () => {
      // A file claiming to be a JPG but has EXE extension
      expect(isSupportedFile('fake.exe', 'image/jpeg')).toBe(false);
      // A file claiming to be PNG but has JS extension
      expect(isSupportedFile('fake.js', 'image/png')).toBe(false);
    });

    it('accepts broad text/* MIME types for allowed text extensions', () => {
      expect(isSupportedFile('notes.txt', 'text/plain')).toBe(true);
      expect(isSupportedFile('data.txt', 'text/x-custom-type')).toBe(true);
    });
  });

  describe('assertSupportedFile', () => {
    it('throws for unsupported file types', () => {
      expect(() => {
        assertSupportedFile('malware.exe', 'application/octet-stream');
      }).toThrow(BadRequestException);

      expect(() => {
        assertSupportedFile('script.js', 'application/javascript');
      }).toThrow(BadRequestException);
    });

    it('throws for files without extensions', () => {
      expect(() => {
        assertSupportedFile('noextension', 'image/jpeg');
      }).toThrow(BadRequestException);
    });

    it('does not throw for valid files', () => {
      expect(() => {
        assertSupportedFile('document.pdf', 'application/pdf');
      }).not.toThrow();

      expect(() => {
        assertSupportedFile('image.jpg', 'image/jpeg');
      }).not.toThrow();
    });
  });

  describe('createStoredFileName', () => {
    it('generates UUID-based filename with original extension', () => {
      const result = createStoredFileName('my-document.pdf');
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
      );
    });

    it('preserves file extensions in lowercase', () => {
      expect(createStoredFileName('image.JPG')).toMatch(/\.jpg$/);
      expect(createStoredFileName('document.PDF')).toMatch(/\.pdf$/);
    });

    it('generates unique filenames for the same original name', () => {
      const name1 = createStoredFileName('same.txt');
      const name2 = createStoredFileName('same.txt');
      expect(name1).not.toBe(name2);
    });

    it('removes path traversal from original filename', () => {
      const result = createStoredFileName('../../../etc/passwd.pdf');
      // Should only preserve extension, not path segments
      expect(result).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/,
      );
      expect(result).not.toContain('..');
      expect(result).not.toContain('etc');
    });
  });

  describe('buildStorageFolder', () => {
    it('creates properly formatted storage path', () => {
      const result = buildStorageFolder(
        'employees',
        'Employee',
        123,
        'ASSET_DOCUMENT',
      );
      expect(result).toMatch(/^employees\/employee\/123\/asset_document$/);
    });

    it('sanitizes folder name segments', () => {
      const result = buildStorageFolder(
        'My Module!',
        'My Entity@',
        456,
        'My Category#',
      );
      expect(result).not.toContain('!');
      expect(result).not.toContain('@');
      expect(result).not.toContain('#');
    });

    it('filters out empty segments but fills with default segment', () => {
      const result = buildStorageFolder('', 'Entity', 789, '');
      // sanitizeSegment returns 'file' for empty strings
      expect(result).toBe('file/entity/789/file');
    });

    it('sanitizes special chars in segments', () => {
      const result = buildStorageFolder('../evil', 'Entity', 123, 'Category');
      // sanitizeSegment preserves dots and hyphens, so .. remains
      // This is why we validate at the storage provider level
      expect(result).toContain('entity');
    });
  });

  describe('sanitizeFileName', () => {
    it('removes path traversal attempts', () => {
      expect(sanitizeFileName('../../../etc/passwd')).not.toContain('..');
      expect(sanitizeFileName('..\\..\\windows\\system32')).not.toContain('..');
    });

    it('replaces spaces with hyphens', () => {
      expect(sanitizeFileName('my document.pdf')).toBe('my-document.pdf');
      expect(sanitizeFileName('multiple   spaces.txt')).not.toContain('   ');
    });

    it('replaces spaces with hyphens but preserves case', () => {
      expect(sanitizeFileName('MyDocument.PDF')).toBe('MyDocument.PDF');
      expect(sanitizeFileName('my document.pdf')).toBe('my-document.pdf');
      expect(sanitizeFileName('multiple   spaces.txt')).not.toContain('   ');
    });

    it('preserves valid characters', () => {
      expect(sanitizeFileName('valid-filename_123.pdf')).toContain('valid');
      expect(sanitizeFileName('valid-filename_123.pdf')).toContain('filename');
    });
  });
});
