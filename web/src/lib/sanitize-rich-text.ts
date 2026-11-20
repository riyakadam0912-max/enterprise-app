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
