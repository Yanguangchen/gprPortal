/** HTML-escape a value for safe innerHTML insertion */
export function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Format an ISO date string (YYYY-MM-DD) for display.
 * @param {string} iso
 * @param {Intl.DateTimeFormatOptions} opts
 */
export function formatDate(iso, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!iso) return '—';
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', opts);
}

export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
