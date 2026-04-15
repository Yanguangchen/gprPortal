import { esc, formatDate } from './utils.js';

/**
 * Build a single gallery image card.
 *
 * @param {Object} rec               Firestore/dummy record
 * @param {Object} callbacks
 * @param {Function} callbacks.onView    Called when the image area is clicked
 * @param {Function} callbacks.onEdit    Called when Edit button is clicked
 * @param {Function} callbacks.onDelete  Called when Delete button is clicked
 * @returns {HTMLElement}
 */
export function buildCard(rec, { onView, onEdit, onDelete } = {}) {
  const card = document.createElement('div');
  card.className  = 'image-card';
  card.dataset.id = rec.id;

  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${esc(rec.imageUrl)}" alt="${esc(rec.imageName)}" loading="lazy" />
      <div class="card-overlay"></div>
      <span class="card-badge">GPR</span>
    </div>
    <div class="card-body">
      <div class="card-company">${esc(rec.companyName)}</div>
      <div class="card-project">${esc(rec.projectName)}</div>
      <div class="card-date">${formatDate(rec.imageDate)}</div>
    </div>
    <div class="card-actions">
      <button class="card-btn card-btn-edit"   type="button">Edit</button>
      <button class="card-btn card-btn-delete" type="button">Delete</button>
    </div>
  `;

  card.querySelector('.card-img-wrap')
    .addEventListener('click', () => onView?.(rec));
  card.querySelector('.card-btn-edit')
    .addEventListener('click', e => { e.stopPropagation(); onEdit?.(rec); });
  card.querySelector('.card-btn-delete')
    .addEventListener('click', e => { e.stopPropagation(); onDelete?.(rec); });

  return card;
}
