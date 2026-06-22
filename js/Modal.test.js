import { describe, it, expect, vi, afterEach } from 'vitest';

// Prevent AudioContext errors in happy-dom — Modal calls audio.action() on open()
vi.mock('./audio.js', () => ({
  audio: {
    action: vi.fn(),
    click: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    isEnabled: vi.fn(() => true),
    setEnabled: vi.fn(),
  },
}));

import { Modal } from './Modal.js';

const FIELDS = [
  { id: 'company', label: 'Company', type: 'text', placeholder: 'ACME' },
  { id: 'project', label: 'Project', type: 'text' },
];

describe('Modal', () => {
  let modal;

  afterEach(() => {
    modal?.destroy();
    modal = null;
    document.body.style.overflow = '';
  });

  describe('constructor', () => {
    it('appends the modal element to document.body', () => {
      modal = new Modal({ title: 'Test' });
      expect(document.body.querySelector('.modal')).not.toBeNull();
    });

    it('renders the title', () => {
      modal = new Modal({ title: 'My Dialog' });
      expect(document.body.querySelector('.modal-title').textContent).toBe('My Dialog');
    });

    it('starts hidden', () => {
      modal = new Modal({ title: 'Test' });
      expect(document.body.querySelector('.modal').hidden).toBe(true);
    });

    it('renders input fields for each field config', () => {
      modal = new Modal({ title: 'Form', fields: FIELDS });
      const inputs = modal._el.querySelectorAll('input');
      expect(inputs).toHaveLength(2);
      expect(inputs[0].id).toBe('modal-f-company');
      expect(inputs[1].id).toBe('modal-f-project');
    });

    it('renders a placeholder when provided', () => {
      modal = new Modal({ title: 'Form', fields: FIELDS });
      const input = modal._el.querySelector('#modal-f-company');
      expect(input.getAttribute('placeholder')).toBe('ACME');
    });

    it('escapes HTML in title', () => {
      modal = new Modal({ title: '<script>xss</script>' });
      expect(modal._el.querySelector('.modal-title').innerHTML).not.toContain('<script>');
    });
  });

  describe('open()', () => {
    it('shows the modal', async () => {
      modal = new Modal({ title: 'Test' });
      modal.open();
      expect(modal._el.hidden).toBe(false);
    });

    it('locks body scroll', () => {
      modal = new Modal({ title: 'Test' });
      modal.open();
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('pre-fills field values from initialValues', () => {
      modal = new Modal({ title: 'Form', fields: FIELDS });
      modal.open({ company: 'Acme', project: 'Alpha' });
      expect(modal._inputMap.company.value).toBe('Acme');
      expect(modal._inputMap.project.value).toBe('Alpha');
    });

    it('returns a Promise', () => {
      modal = new Modal({ title: 'Test' });
      const p = modal.open();
      expect(p).toBeInstanceOf(Promise);
      // dismiss to settle the promise
      modal._dismiss();
    });
  });

  describe('close()', () => {
    it('hides the modal and restores scroll', () => {
      modal = new Modal({ title: 'Test' });
      modal.open();
      modal.close();
      expect(modal._el.hidden).toBe(true);
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('confirm button', () => {
    it('resolves the promise with field values on confirm', async () => {
      modal = new Modal({ title: 'Form', fields: FIELDS });
      const promise = modal.open({ company: 'Acme', project: 'Beta' });
      modal._confirmBtn.click();
      const result = await promise;
      expect(result).toEqual({ company: 'Acme', project: 'Beta' });
    });

    it('resolves with true for a confirm-only modal (no fields)', async () => {
      modal = new Modal({ title: 'Confirm?', bodyHTML: '<p>Are you sure?</p>' });
      const promise = modal.open();
      modal._confirmBtn.click();
      const result = await promise;
      expect(result).toBe(true);
    });
  });

  describe('cancel / dismiss', () => {
    it('resolves with null when Cancel is clicked', async () => {
      modal = new Modal({ title: 'Test' });
      const promise = modal.open();
      modal._cancelBtn.click();
      const result = await promise;
      expect(result).toBeNull();
    });

    it('resolves with null when backdrop is clicked', async () => {
      modal = new Modal({ title: 'Test' });
      const promise = modal.open();
      modal._backdrop.click();
      const result = await promise;
      expect(result).toBeNull();
    });

    it('resolves with null on Escape key', async () => {
      modal = new Modal({ title: 'Test' });
      const promise = modal.open();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      const result = await promise;
      expect(result).toBeNull();
    });

    it('does not dismiss while loading', () => {
      modal = new Modal({ title: 'Test' });
      modal.open();
      modal.setLoading(true);
      modal._cancelBtn.click();
      expect(modal._el.hidden).toBe(false);
      modal.setLoading(false);
    });
  });

  describe('setLoading()', () => {
    it('disables confirm button and shows spinner when true', () => {
      modal = new Modal({ title: 'Test' });
      modal.setLoading(true);
      expect(modal._confirmBtn.disabled).toBe(true);
      expect(modal._confirmText.hidden).toBe(true);
      expect(modal._spinner.hidden).toBe(false);
    });

    it('re-enables confirm button and hides spinner when false', () => {
      modal = new Modal({ title: 'Test' });
      modal.setLoading(true);
      modal.setLoading(false);
      expect(modal._confirmBtn.disabled).toBe(false);
      expect(modal._confirmText.hidden).toBe(false);
      expect(modal._spinner.hidden).toBe(true);
    });
  });

  describe('setStatus()', () => {
    it('sets status text content', () => {
      modal = new Modal({ title: 'Test' });
      modal.setStatus('Something went wrong', 'error');
      expect(modal._statusEl.textContent).toBe('Something went wrong');
    });

    it('applies the type as a CSS class suffix', () => {
      modal = new Modal({ title: 'Test' });
      modal.setStatus('OK', 'success');
      expect(modal._statusEl.className).toContain('success');
    });

    it('clears the message when called with empty string', () => {
      modal = new Modal({ title: 'Test' });
      modal.setStatus('error!', 'error');
      modal.setStatus('', '');
      expect(modal._statusEl.textContent).toBe('');
    });
  });

  describe('getValues()', () => {
    it('returns current field values', () => {
      modal = new Modal({ title: 'Form', fields: FIELDS });
      modal._inputMap.company.value = 'TechCo';
      modal._inputMap.project.value = 'Gamma';
      expect(modal.getValues()).toEqual({ company: 'TechCo', project: 'Gamma' });
    });
  });

  describe('destroy()', () => {
    it('removes the modal element from the DOM', () => {
      modal = new Modal({ title: 'Test' });
      modal.destroy();
      expect(document.body.querySelector('.modal')).toBeNull();
      modal = null;
    });
  });
});
