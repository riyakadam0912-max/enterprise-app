import DOMPurify from 'dompurify';

// Keep Word-style formatting supported by the shared editor while removing
// executable markup and unsafe URLs.
export function sanitizeRichText(value: string): string {
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'a', 'font'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'color', 'face', 'size', 'align'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):)/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
  });
}

const ENCODED_RICH_TEXT_TAG = /&(?:amp;)?lt;\/?(?:p|br|div|span|b|strong|i|em|u|s|strike|ul|ol|li|h[1-3]|blockquote|a|font)(?:\s|&(?:amp;)?gt;)/i;

/**
 * Older task descriptions were stored with their rich-text tags HTML-encoded.
 * Decode only values that clearly contain supported editor markup, then run
 * the result through the same allow-list sanitizer used for normal content.
 */
export function sanitizeRichTextForDisplay(value: string): string {
  let normalized = value;

  if (typeof document !== 'undefined' && ENCODED_RICH_TEXT_TAG.test(normalized)) {
    for (let pass = 0; pass < 2 && ENCODED_RICH_TEXT_TAG.test(normalized); pass += 1) {
      const decoder = document.createElement('textarea');
      decoder.innerHTML = normalized;
      normalized = decoder.value;
    }
  }

  return sanitizeRichText(normalized);
}
