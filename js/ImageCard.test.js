import { describe, it, expect, vi } from 'vitest';
import { buildCard } from './ImageCard.js';

const sample = {
  id: 'rec1',
  imageUrl: 'https://example.com/img.jpg',
  imageName: 'photo.jpg',
  companyName: 'ACME Corp',
  projectName: 'Site Survey',
  workSite: 'Downtown',
  imageDate: '2024-03-15',
};

describe('buildCard', () => {
  it('returns a div.image-card with the correct data-id', () => {
    const card = buildCard(sample);
    expect(card.tagName).toBe('DIV');
    expect(card.className).toBe('image-card');
    expect(card.dataset.id).toBe('rec1');
  });

  it('renders image with correct src and alt', () => {
    const card = buildCard(sample);
    const img = card.querySelector('img');
    expect(img.getAttribute('src')).toBe('https://example.com/img.jpg');
    expect(img.getAttribute('alt')).toBe('photo.jpg');
  });

  it('renders company, project, work site, and formatted date', () => {
    const card = buildCard(sample);
    expect(card.querySelector('.card-company').textContent).toBe('ACME Corp');
    expect(card.querySelector('.card-project').textContent).toBe('Site Survey');
    expect(card.querySelector('.card-work-site').textContent).toBe('Downtown');
    expect(card.querySelector('.card-date').textContent).toMatch(/Mar 15, 2024/);
  });

  it('falls back to "No work site specified" when workSite is falsy', () => {
    const card = buildCard({ ...sample, workSite: '' });
    expect(card.querySelector('.card-work-site').textContent).toBe('No work site specified');
  });

  it('HTML-escapes dangerous strings in text fields', () => {
    const card = buildCard({ ...sample, companyName: '<script>xss</script>' });
    const el = card.querySelector('.card-company');
    expect(el.innerHTML).not.toContain('<script>');
    expect(el.textContent).toBe('<script>xss</script>');
  });

  it('does not create rogue DOM elements from dangerous imageUrl/imageName values', () => {
    const card = buildCard({ ...sample, imageUrl: '"><script>bad</script>', imageName: '"><img>' });
    // Escaping must prevent injection — no stray <script> or extra <img> elements should appear
    expect(card.querySelectorAll('script')).toHaveLength(0);
    // Only the one intentional <img> inside .card-img-wrap should exist
    expect(card.querySelectorAll('img')).toHaveLength(1);
  });

  it('calls onView with the record when the image wrap is clicked', () => {
    const onView = vi.fn();
    const card = buildCard(sample, { onView });
    card.querySelector('.card-img-wrap').click();
    expect(onView).toHaveBeenCalledOnce();
    expect(onView).toHaveBeenCalledWith(sample);
  });

  it('calls onEdit with the record when the Edit button is clicked', () => {
    const onEdit = vi.fn();
    const card = buildCard(sample, { onEdit });
    card.querySelector('.card-btn-edit').click();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith(sample);
  });

  it('calls onDelete with the record when the Delete button is clicked', () => {
    const onDelete = vi.fn();
    const card = buildCard(sample, { onDelete });
    card.querySelector('.card-btn-delete').click();
    expect(onDelete).toHaveBeenCalledOnce();
    expect(onDelete).toHaveBeenCalledWith(sample);
  });

  it('does not throw when no callbacks are provided', () => {
    const card = buildCard(sample);
    expect(() => card.querySelector('.card-img-wrap').click()).not.toThrow();
    expect(() => card.querySelector('.card-btn-edit').click()).not.toThrow();
    expect(() => card.querySelector('.card-btn-delete').click()).not.toThrow();
  });

  it('renders Edit and Delete buttons', () => {
    const card = buildCard(sample);
    expect(card.querySelector('.card-btn-edit').textContent).toBe('Edit');
    expect(card.querySelector('.card-btn-delete').textContent).toBe('Delete');
  });
});
