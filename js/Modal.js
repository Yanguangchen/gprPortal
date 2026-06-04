import { esc } from './utils.js';
import { audio } from './audio.js';

/**
 * Reusable dark-glass modal.
 *
 * Supports two modes:
 *   - Form modal:    pass `fields` array → renders labelled inputs
 *   - Confirm modal: pass `bodyHTML` only → renders static content
 *
 * Usage:
 *   const modal = new Modal({ title, fields, confirmLabel, confirmVariant });
 *
 *   // Returns a Promise that resolves with:
 *   //   { fieldId: value, ... }  — user confirmed (form modal)
 *   //   true                     — user confirmed (confirm modal, no fields)
 *   //   null                     — user cancelled
 *   const result = await modal.open(initialValues);
 *
 *   if (result) {
 *     modal.setLoading(true);
 *     try { await doWork(); modal.close(); }
 *     catch (e) { modal.setStatus('Failed.', 'error'); }
 *     finally { modal.setLoading(false); }
 *   }
 *
 * @param {Object}   options
 * @param {string}   options.title
 * @param {string}   [options.bodyHTML]        Static HTML rendered above fields
 * @param {Array}    [options.fields]          [{ id, label, type, placeholder? }]
 * @param {string}   [options.confirmLabel]    Default: 'Confirm'
 * @param {string}   [options.confirmVariant]  'primary' | 'danger'. Default: 'primary'
 * @param {string}   [options.size]            'md' | 'sm'. Default: 'md'
 */
export class Modal {
  constructor({
    title,
    bodyHTML = '',
    fields = [],
    confirmLabel = 'Confirm',
    confirmVariant = 'primary',
    size = 'md',
  }) {
    this._fields  = fields;
    this._resolve = null;

    const el = document.createElement('div');
    el.className = 'modal';
    el.hidden = true;
    el.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="glass modal-box${size === 'sm' ? ' modal-box--sm' : ''}">
        <h3 class="modal-title">${esc(title)}</h3>
        ${bodyHTML}
        <div class="modal-fields"></div>
        <div class="modal-actions">
          <button class="btn-ghost modal-cancel" type="button">Cancel</button>
          <button class="btn-${esc(confirmVariant)} modal-confirm" type="button">
            <span class="modal-confirm-text">${esc(confirmLabel)}</span>
            <span class="spinner" hidden></span>
          </button>
        </div>
        <p class="upload-status modal-status"></p>
      </div>
    `;

    this._el          = el;
    this._backdrop    = el.querySelector('.modal-backdrop');
    this._fieldsEl    = el.querySelector('.modal-fields');
    this._cancelBtn   = el.querySelector('.modal-cancel');
    this._confirmBtn  = el.querySelector('.modal-confirm');
    this._confirmText = el.querySelector('.modal-confirm-text');
    this._spinner     = el.querySelector('.spinner');
    this._statusEl    = el.querySelector('.modal-status');

    // Render input fields
    this._inputMap = {};
    fields.forEach(f => {
      const group = document.createElement('div');
      group.className = 'field-group';
      group.innerHTML = `
        <label for="modal-f-${esc(f.id)}">${esc(f.label)}</label>
        <input type="${esc(f.type)}" id="modal-f-${esc(f.id)}"
          ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} />
      `;
      this._fieldsEl.appendChild(group);
      this._inputMap[f.id] = group.querySelector('input');
    });

    document.body.appendChild(el);

    this._cancelBtn.addEventListener('click', () => this._dismiss());
    this._backdrop.addEventListener('click',  () => this._dismiss());
    this._confirmBtn.addEventListener('click', () => this._handleConfirm());
    document.addEventListener('keydown', this._onKey = e => {
      if (e.key === 'Escape' && !el.hidden) this._dismiss();
    });
  }

  /**
   * Open the modal, optionally pre-fill fields.
   * @param {Object} initialValues  { [fieldId]: value }
   * @returns {Promise<Object|true|null>}
   */
  open(initialValues = {}) {
    audio.action();
    Object.entries(initialValues).forEach(([k, v]) => {
      if (this._inputMap[k]) this._inputMap[k].value = v ?? '';
    });
    this.setStatus('', '');
    this.setLoading(false);
    this._el.hidden = false;
    document.body.style.overflow = 'hidden';
    const first = Object.values(this._inputMap)[0];
    if (first) first.focus();
    return new Promise(res => { this._resolve = res; });
  }

  /** Close without resolving (call after async work succeeds). */
  close() {
    this._el.hidden = true;
    document.body.style.overflow = '';
  }

  setStatus(msg, type) {
    this._statusEl.textContent = msg;
    this._statusEl.className = `upload-status modal-status${type ? ' ' + type : ''}`;
  }

  /** Disable the confirm button and show spinner while async work runs. */
  setLoading(on) {
    this._confirmBtn.disabled = on;
    this._confirmText.hidden  = on;
    this._spinner.hidden      = !on;
  }

  getValues() {
    return Object.fromEntries(
      Object.entries(this._inputMap).map(([k, inp]) => [k, inp.value])
    );
  }

  /** Remove from DOM. Call when the modal will never be used again. */
  destroy() {
    document.removeEventListener('keydown', this._onKey);
    this._el.remove();
  }

  // ── Private ─────────────────────────────────────────────────────

  _dismiss() {
    if (this._confirmBtn.disabled) return; // don't close while loading
    this._el.hidden = true;
    document.body.style.overflow = '';
    if (this._resolve) { this._resolve(null); this._resolve = null; }
  }

  _handleConfirm() {
    // Resolve with field values (or `true` for confirm-only dialogs).
    // The modal stays open — caller decides when to close() it.
    const values = Object.keys(this._inputMap).length > 0 ? this.getValues() : true;
    if (this._resolve) { this._resolve(values); this._resolve = null; }
  }
}
