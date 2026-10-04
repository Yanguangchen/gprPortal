import { esc, formatBytes } from './utils.js';
import { audio } from './audio.js';

/**
 * Full-screen processing modal shown while a batch of scans is
 * compressed and uploaded. It narrates the JPEG pipeline the browser
 * runs inside `compressImage()` stage by stage, with live stats, a log
 * console and per-file + overall progress.
 *
 * Each compression stage stays on screen for a minimum time (scaled by
 * `pace`) so the pipeline reads clearly even when the real work is
 * instant; it also waits for the real work when that is slower.
 *
 * Usage (driven by UploadPanel):
 *   const modal = new UploadModal({ pace: 1 });
 *   modal.open(files);
 *   const out = await modal.compress(i, onDecoded => compressImage(file, { onDecoded }));
 *   await api.create(out, meta, pct => modal.setUploadProgress(i, pct));
 *   await modal.completeFile(i);        // or modal.failFile(i, message)
 *   await modal.finish();               // resolves when the user closes it
 */

const COMPRESS_STEPS = [
  { id: 'decode',   code: 'DEC', label: 'Decoding radar raster',         ms: 380 },
  { id: 'resample', code: 'RSM', label: 'Adaptive resampling',           ms: 420 },
  { id: 'ycbcr',    code: 'YCC', label: 'RGB → YCbCr colour transform',  ms: 300 },
  { id: 'chroma',   code: 'CHR', label: 'Chroma subsampling',            ms: 280 },
  { id: 'dct',      code: 'DCT', label: '8×8 discrete cosine transform', ms: 1100 },
  { id: 'quant',    code: 'QNT', label: 'Coefficient quantisation',      ms: 380 },
  { id: 'entropy',  code: 'HUF', label: 'Huffman entropy coding',        ms: 400 },
];
const TRANSFER_STEPS = [
  { id: 'upload', code: 'TLS', label: 'Encrypted upload' },
  { id: 'index',  code: 'IDX', label: 'Indexing scan record', ms: 350 },
];
const STEPS = [...COMPRESS_STEPS, ...TRANSFER_STEPS];

// Share of each file's progress owned by compression and upload; indexing gets the rest.
const W_COMPRESS = 0.5;
const W_UPLOAD   = 0.45;

const n2 = n => String(n).padStart(2, '0');
const num = n => n.toLocaleString('en-US');

export class UploadModal {
  /** @param {{ pace?: number }} [opts]  Multiplier for minimum stage durations (0 = no padding). */
  constructor({ pace = 1 } = {}) {
    this._pace    = pace;
    this._files   = [];
    this._closed  = null;
    this._done    = false;
    this._clockId = null;

    const el = document.createElement('div');
    el.className = 'modal up-modal';
    el.hidden = true;
    el.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="surface modal-box up-box" role="dialog" aria-modal="true"
           aria-labelledby="up-modal-title" tabindex="-1">

        <header class="up-head">
          <span class="up-head-ic" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/>
              <circle cx="12" cy="12" r="5"/>
              <g class="up-head-sweep"><path d="M12 12 L12 3"/></g>
              <circle cx="12" cy="12" r="1.4" class="dot"/>
            </svg>
          </span>
          <div class="up-head-txt">
            <h3 class="modal-title js-title" id="up-modal-title">Processing scans</h3>
            <p class="up-sub js-sub" aria-live="polite"></p>
          </div>
          <span class="up-clock js-clock" aria-hidden="true">00:00.0</span>
        </header>

        <div class="up-body">
          <div class="up-stage">
            <div class="up-view js-view" data-phase="compress">
              <img class="up-raw" alt="" />
              <img class="up-clean" alt="" />
              <div class="up-grid-ov" aria-hidden="true"></div>
              <div class="up-stream" aria-hidden="true"></div>
              <div class="up-scanline" aria-hidden="true"></div>
              <span class="up-hud tl js-hud-tl"></span>
              <span class="up-hud tr js-hud-tr"></span>
              <span class="up-hud bl js-hud-bl"></span>
              <span class="up-hud br js-hud-br"></span>
              <span class="up-check" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
              </span>
            </div>
            <dl class="up-stats">
              <div><dt>Original</dt><dd class="js-before">—</dd></div>
              <div><dt>Compressed</dt><dd class="js-after">—</dd></div>
              <div><dt>Reduction</dt><dd class="js-saved">—</dd></div>
            </dl>
          </div>

          <div class="up-side">
            <div class="up-side-label">Compression pipeline</div>
            <ol class="up-steps">
              ${STEPS.map(s => `
                <li class="up-step" data-step="${s.id}">
                  <span class="up-step-ic" aria-hidden="true"></span>
                  <span class="up-step-label">${esc(s.label)}</span>
                  <span class="up-step-val"></span>
                </li>`).join('')}
            </ol>
            <div class="up-log js-log" role="log" aria-label="Processing log"></div>
          </div>
        </div>

        <ul class="up-files js-files"></ul>

        <div class="up-dock">
          <div class="up-overall">
            <div class="up-overall-row">
              <span>Overall progress</span>
              <span class="up-overall-pct js-overall-pct">0%</span>
            </div>
            <div class="up-bar" role="progressbar" aria-label="Overall progress"
                 aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <div class="up-bar-fill js-overall-fill"></div>
            </div>
          </div>

          <div class="up-foot">
            <p class="up-summary js-summary"></p>
            <button class="btn-primary up-done-btn js-done" type="button" hidden>Done</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    const $ = sel => el.querySelector(sel);
    this._el       = el;
    this._box      = $('.up-box');
    this._title    = $('.js-title');
    this._sub      = $('.js-sub');
    this._clock    = $('.js-clock');
    this._view     = $('.js-view');
    this._raw      = $('.up-raw');
    this._clean    = $('.up-clean');
    this._hud      = { tl: $('.js-hud-tl'), tr: $('.js-hud-tr'), bl: $('.js-hud-bl'), br: $('.js-hud-br') };
    this._beforeEl = $('.js-before');
    this._afterEl  = $('.js-after');
    this._savedEl  = $('.js-saved');
    this._logEl    = $('.js-log');
    this._filesEl  = $('.js-files');
    this._barEl    = $('.up-bar');
    this._fillEl   = $('.js-overall-fill');
    this._pctEl    = $('.js-overall-pct');
    this._summary  = $('.js-summary');
    this._doneBtn  = $('.js-done');
    this._stepEls  = Object.fromEntries(STEPS.map(s => [s.id, el.querySelector(`[data-step="${s.id}"]`)]));

    this._doneBtn.addEventListener('click', () => this.close());
    $('.modal-backdrop').addEventListener('click', () => { if (this._done) this.close(); });
    document.addEventListener('keydown', this._onKey = e => {
      if (e.key === 'Escape' && !el.hidden && this._done) this.close();
    });
  }

  /** Show the modal for a new batch. */
  open(files) {
    this._revokeUrls();
    this._files = files.map(file => ({
      file,
      url: URL.createObjectURL(file),
      status: 'queued',
      progress: 0,
      step: null,
      info: null,
      after: null,
      blocks: 0,
    }));
    this._done    = false;
    this._current = 0;
    this._t0      = performance.now();
    this._returnFocus = document.activeElement;

    this._title.textContent = 'Processing scans';
    this._summary.textContent = 'Keep this window open until every scan has finished.';
    this._summary.className = 'up-summary js-summary';
    this._doneBtn.hidden = true;
    this._logEl.innerHTML = '';
    this._box.classList.remove('is-finished');
    this._renderFiles();
    this._setOverall();
    this._showFile(0);

    this._log('init', `pipeline armed · ${files.length} scan${files.length > 1 ? 's' : ''} queued`);
    this._clockId = setInterval(() => this._tickClock(), 100);
    this._tickClock();

    this._el.hidden = false;
    document.body.style.overflow = 'hidden';
    this._box.focus();
  }

  /**
   * Run the compression stages for file `i` while `run(onDecoded)` does the
   * real work. Resolves with run's result; rejects if it fails.
   */
  async compress(i, run) {
    const f = this._files[i];
    this._showFile(i);
    f.status = 'active';
    this._renderFile(i);
    this._sub.textContent = `Compressing scan ${i + 1} of ${this._files.length} · ${f.file.name}`;

    let decodedResolve;
    const decoded = new Promise(r => { decodedResolve = r; });
    const onDecoded = info => {
      f.info   = info;
      f.blocks = jpegBlocks(info.outWidth, info.outHeight);
      this._log('raster', `${info.width}×${info.height} px · ${(info.width * info.height / 1e6).toFixed(1)} MP decoded`);
      decodedResolve();
    };

    const work   = Promise.resolve().then(() => run(onDecoded));
    const failed = work.then(() => new Promise(() => {}));
    failed.catch(() => {});

    let out = null;
    for (const [k, step] of COMPRESS_STEPS.entries()) {
      this._activate(i, step);
      this._logStepStart(f, step);
      const gate = step.id === 'decode'  ? Promise.race([decoded, work])
                 : step.id === 'entropy' ? work
                 : null;
      const [, res] = await Promise.race([
        Promise.all([this._animate(step.ms, t => this._tickCompress(i, k, t, step)), gate]),
        failed,
      ]);
      this._tickCompress(i, k, 1, step); // refresh with info that arrived after the animation
      if (step.id === 'entropy') {
        out = res;
        f.after = res.size;
        this._showStats(f);
        this._log('huffman', `${formatBytes(f.file.size)} → ${formatBytes(res.size)} · ${savedLabel(f.file.size, res.size)}`);
      }
      this._complete(i, step.id);
    }

    f.progress = W_COMPRESS;
    this._view.dataset.phase = 'upload';
    this._activate(i, TRANSFER_STEPS[0]);
    this._setStepVal('upload', '0%');
    this._hud.br.textContent = 'TX 0%';
    this._sub.textContent = `Uploading scan ${i + 1} of ${this._files.length} · ${f.file.name}`;
    this._log('upload', `${out.name} · ${formatBytes(out.size)} over TLS`);
    this._renderFile(i);
    this._setOverall();
    return out;
  }

  /** Report real upload progress (0–100) for file `i`. */
  setUploadProgress(i, pct) {
    const f = this._files[i];
    if (f.step !== 'upload') return;
    const p = Math.min(Math.max(Math.round(pct), 0), 100);
    f.progress = W_COMPRESS + W_UPLOAD * p / 100;
    this._setStepVal('upload', p + '%');
    this._setStepT('upload', p / 100);
    this._hud.br.textContent = `TX ${p}%`;
    this._renderFile(i);
    this._setOverall();
    if (p >= 100) this._beginIndex(i);
  }

  /** Mark file `i` uploaded + saved. */
  async completeFile(i) {
    const f = this._files[i];
    if (f.step === 'upload') this._beginIndex(i);
    await this._animate(TRANSFER_STEPS[1].ms, t => this._setStepT('index', t));
    this._complete(i, 'index');
    this._setStepVal('index', 'committed');
    this._log('index', 'record committed to gpr_images');
    f.status   = 'done';
    f.progress = 1;
    this._view.dataset.phase = 'done';
    this._hud.tr.textContent = 'OK';
    this._hud.br.textContent = savedLabel(f.file.size, f.after);
    this._renderFile(i);
    this._setOverall();
    audio.action();
  }

  /** Mark file `i` failed with a user-facing message. */
  failFile(i, message) {
    const f = this._files[i];
    if (f.step) this._stepEls[f.step].className = 'up-step is-error';
    f.status = 'error';
    f.error  = message;
    this._view.dataset.phase = 'error';
    this._hud.tr.textContent = 'ERR';
    this._log('error', message, true);
    this._renderFile(i);
    this._setOverall();
  }

  /** Switch to the summary state. Resolves when the user closes the modal. */
  finish() {
    this._done = true;
    clearInterval(this._clockId);
    this._tickClock();

    const ok     = this._files.filter(f => f.status === 'done');
    const failed = this._files.length - ok.length;
    const before = ok.reduce((s, f) => s + f.file.size, 0);
    const after  = ok.reduce((s, f) => s + f.after, 0);

    this._title.textContent = failed === 0 ? 'Upload complete'
      : ok.length ? 'Upload finished with errors' : 'Upload failed';
    this._sub.textContent = `${ok.length} of ${this._files.length} scan${this._files.length > 1 ? 's' : ''} uploaded`;
    this._box.classList.add('is-finished');

    if (ok.length) {
      const pct = savedPct(before, after);
      this._summary.innerHTML =
        `<b>${ok.length} scan${ok.length > 1 ? 's' : ''}</b> · ${esc(formatBytes(before))} → ` +
        `<b>${esc(formatBytes(after))}</b> · ${Math.abs(pct)}% ${pct >= 0 ? 'smaller' : 'larger'}` +
        (failed ? ` · <span class="err">${failed} failed</span>` : '');
      this._log('done', `batch complete · ${formatBytes(before)} → ${formatBytes(after)}`);
    } else {
      this._summary.innerHTML = '<span class="err">No scans were uploaded.</span>';
    }
    this._summary.classList.add(failed ? 'has-errors' : 'is-success');
    this._setOverall();
    this._doneBtn.hidden = false;
    this._doneBtn.focus();

    return new Promise(res => { this._closed = res; });
  }

  close() {
    this._el.hidden = true;
    document.body.style.overflow = '';
    clearInterval(this._clockId);
    this._revokeUrls();
    this._returnFocus?.focus?.();
    if (this._closed) { this._closed(); this._closed = null; }
  }

  destroy() {
    document.removeEventListener('keydown', this._onKey);
    clearInterval(this._clockId);
    this._revokeUrls();
    this._el.remove();
  }

  // ── Private ──────────────────────────────────────────────────────

  _showFile(i) {
    const f = this._files[i];
    this._current = i;
    this._raw.src   = f.url;
    this._clean.src = f.url;
    this._view.dataset.phase = 'compress';
    this._view.dataset.step  = '';
    this._view.style.setProperty('--reveal', 0);
    this._hud.tl.textContent = `SCAN ${n2(i + 1)}/${n2(this._files.length)}`;
    this._hud.tr.textContent = 'RDY';
    this._hud.bl.textContent = formatBytes(f.file.size);
    this._hud.br.textContent = '';
    this._beforeEl.textContent = formatBytes(f.file.size);
    this._afterEl.textContent  = '···';
    this._savedEl.textContent  = '···';
    [this._afterEl, this._savedEl].forEach(el => {
      el.classList.add('is-pending');
      el.classList.remove('is-good');
    });
    STEPS.forEach(s => {
      this._stepEls[s.id].className = 'up-step';
      this._setStepVal(s.id, '');
      this._setStepT(s.id, 0);
    });
  }

  _activate(i, step) {
    const f = this._files[i];
    f.step = step.id;
    this._stepEls[step.id].className = 'up-step is-active';
    this._view.dataset.step = step.id;
    this._hud.tr.textContent = step.code;
  }

  _complete(i, id) {
    this._stepEls[id].className = 'up-step is-done';
    this._setStepT(id, 1);
    if (COMPRESS_STEPS.some(s => s.id === id)) audio.click();
  }

  _beginIndex(i) {
    const f = this._files[i];
    this._complete(i, 'upload');
    this._setStepVal('upload', '100%');
    this._log('upload', 'transfer verified');
    this._activate(i, TRANSFER_STEPS[1]);
    this._setStepVal('index', 'writing');
    f.progress = W_COMPRESS + W_UPLOAD;
    this._sub.textContent = `Indexing scan ${i + 1} of ${this._files.length} · ${f.file.name}`;
    this._renderFile(i);
    this._setOverall();
  }

  /** Per-frame update while compression step `k` of file `i` is on screen. */
  _tickCompress(i, k, t, step) {
    const f = this._files[i];
    if (f.status !== 'active' || this._current !== i) return; // stale tick after a failure
    const frac = (k + t) / COMPRESS_STEPS.length;
    f.progress = W_COMPRESS * frac;
    this._view.style.setProperty('--reveal', frac.toFixed(4));
    this._setStepT(step.id, t);

    const info = f.info;
    let val = '';
    switch (step.id) {
      case 'decode':
        val = info ? `${info.width}×${info.height}` : '…';
        if (info) this._hud.bl.textContent = `${info.width}×${info.height}`;
        break;
      case 'resample':
        if (info) {
          const same = info.outWidth === info.width && info.outHeight === info.height;
          val = same ? 'native' : `${info.outWidth}×${info.outHeight}`;
          this._hud.bl.textContent = same
            ? `${info.width}×${info.height}`
            : `${info.width}×${info.height} → ${info.outWidth}×${info.outHeight}`;
        }
        break;
      case 'ycbcr':  val = 'BT.601'; break;
      case 'chroma': val = '4:2:0'; break;
      case 'dct': {
        const done = Math.round(f.blocks * t);
        val = f.blocks ? `${num(done)} blk` : `${Math.round(t * 100)}%`;
        this._hud.br.textContent = f.blocks ? `BLK ${num(done)}` : '';
        const q = Math.floor(t * 4);
        if (f.blocks && q > (f.dctLogged ?? 0)) {
          f.dctLogged = q;
          this._log('dct', `block ${num(Math.round(f.blocks * q / 4))} / ${num(f.blocks)}`);
        }
        break;
      }
      case 'quant':
        val = info?.quality != null ? `q ${info.quality}` : '…';
        break;
      case 'entropy':
        val = `${Math.round(t * 100)}%`;
        break;
    }
    if (step.id !== 'dct' || f.blocks) this._setStepVal(step.id, val);
    if (step.id === 'entropy' && t >= 1 && f.after == null) this._setStepVal('entropy', 'encoding…');
    this._renderFile(i);
    this._setOverall();
  }

  _logStepStart(f, step) {
    const info = f.info;
    switch (step.id) {
      case 'decode':   this._log('decode', `${f.file.name} · ${formatBytes(f.file.size)}`); break;
      case 'resample': this._log('resample', !info ? 'fitting to delivery bounds'
        : info.outWidth === info.width && info.outHeight === info.height
          ? 'within delivery bounds · native resolution kept'
          : `${info.width}×${info.height} → ${info.outWidth}×${info.outHeight}`); break;
      case 'ycbcr':    this._log('ycbcr', 'luma / chroma separation · BT.601'); break;
      case 'chroma':   this._log('chroma', info
        ? `4:2:0 · chroma planes ${Math.ceil(info.outWidth / 2)}×${Math.ceil(info.outHeight / 2)}`
        : '4:2:0'); break;
      case 'dct':      f.dctLogged = 0;
                       this._log('dct', f.blocks ? `${num(f.blocks)} blocks queued` : 'transforming 8×8 blocks'); break;
      case 'quant':    this._log('quant', `64-coefficient tables${info?.quality != null ? ` · quality ${info.quality}` : ''}`); break;
      case 'entropy':  this._log('huffman', 'building code tables'); break;
    }
  }

  _setStepVal(id, text) {
    this._stepEls[id].querySelector('.up-step-val').textContent = text;
  }

  _setStepT(id, t) {
    this._stepEls[id].style.setProperty('--t', t);
  }

  _showStats(f) {
    const pct = savedPct(f.file.size, f.after);
    this._afterEl.textContent = formatBytes(f.after);
    this._savedEl.textContent = savedLabel(f.file.size, f.after);
    this._afterEl.classList.remove('is-pending');
    this._savedEl.classList.remove('is-pending');
    this._savedEl.classList.toggle('is-good', pct >= 0);
    this._setStepVal('entropy', formatBytes(f.after));
  }

  _renderFiles() {
    this._filesEl.innerHTML = this._files.map((f, i) => `
      <li class="up-file is-queued" data-idx="${i}">
        <span class="up-file-thumb"><img src="${esc(f.url)}" alt="" /></span>
        <span class="up-file-txt">
          <span class="up-file-name">${esc(f.file.name)}</span>
          <span class="up-file-state">Queued</span>
        </span>
      </li>`).join('');
  }

  _renderFile(i) {
    const f  = this._files[i];
    const li = this._filesEl.children[i];
    if (!li) return;
    li.className = `up-file is-${f.status}`;
    li.style.setProperty('--p', f.progress.toFixed(4));
    let state = 'Queued';
    if (f.status === 'done')  state = `Done · ${savedLabel(f.file.size, f.after)}`;
    else if (f.status === 'error') state = 'Failed';
    else if (f.status === 'active') {
      state = f.step === 'upload' ? `Uploading ${Math.round((f.progress - W_COMPRESS) / W_UPLOAD * 100)}%`
            : f.step === 'index'  ? 'Indexing…'
            : `Compressing ${Math.round(f.progress / W_COMPRESS * 100)}%`;
    }
    li.querySelector('.up-file-state').textContent = state;
    li.title = f.error || '';
  }

  _setOverall() {
    const n = this._files.length || 1;
    const settled = f => f.status === 'error' ? 1 : f.progress;
    const pct = Math.round(this._files.reduce((s, f) => s + settled(f), 0) / n * 100);
    this._fillEl.style.width = pct + '%';
    this._pctEl.textContent  = pct + '%';
    this._barEl.setAttribute('aria-valuenow', pct);
  }

  _log(key, msg, isErr = false) {
    const line = document.createElement('div');
    line.className = 'up-log-line' + (isErr ? ' err' : '');
    line.innerHTML = `<span class="t">${elapsed(performance.now() - this._t0)}</span>` +
      `<span class="k">${esc(key)}</span><span class="m">${esc(msg)}</span>`;
    this._logEl.appendChild(line);
    while (this._logEl.children.length > 60) this._logEl.firstChild.remove();
    this._logEl.scrollTop = this._logEl.scrollHeight;
  }

  _tickClock() {
    this._clock.textContent = elapsed(performance.now() - this._t0);
  }

  /** Resolve after `ms * pace`, calling onTick(t∈[0,1]) along the way. */
  _animate(ms, onTick) {
    const dur = (ms || 0) * this._pace;
    if (dur <= 0) { onTick?.(1); return Promise.resolve(); }
    return new Promise(resolve => {
      const start = performance.now();
      const frame = () => {
        const t = Math.min((performance.now() - start) / dur, 1);
        onTick?.(t);
        if (t < 1) setTimeout(frame, 40); else resolve();
      };
      frame();
    });
  }

  _revokeUrls() {
    this._files.forEach(f => URL.revokeObjectURL(f.url));
  }
}

/** 8×8 blocks a baseline 4:2:0 JPEG encodes: full-res luma + two quarter-res chroma planes. */
function jpegBlocks(w, h) {
  return Math.ceil(w / 8) * Math.ceil(h / 8) + 2 * Math.ceil(w / 16) * Math.ceil(h / 16);
}

function savedPct(before, after) {
  return before > 0 ? Math.round((1 - after / before) * 100) : 0;
}

function savedLabel(before, after) {
  const pct = savedPct(before, after);
  return pct >= 0 ? `−${pct}%` : `+${-pct}%`;
}

function elapsed(ms) {
  const tenths = Math.floor(ms / 100);
  return `${n2(Math.floor(tenths / 600))}:${((tenths % 600) / 10).toFixed(1).padStart(4, '0')}`;
}
