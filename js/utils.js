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

/**
 * Compress/resize an image File before uploading to Firebase Storage.
 * Keeps file sizes small to stay within the Spark (free) plan limits.
 *
 * @param {File} file         - Original image file
 * @param {object} [opts]
 * @param {number} [opts.maxWidth=1920]
 * @param {number} [opts.maxHeight=1080]
 * @param {number} [opts.quality=0.82]   JPEG quality 0-1
 * @returns {Promise<File>}              Compressed JPEG File
 */
export function compressImage(file, { maxWidth = 1920, maxHeight = 1080, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('Image compression failed')); return; }
        const outName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        resolve(new File([blob], outName, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}
