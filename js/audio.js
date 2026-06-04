/**
 * audio.js — Web Audio API feedback system.
 * Generates synthesized sounds for UI interactions.
 */

const STORAGE = 'gpr-audio-enabled';
let audioContext = null;
let enabled = localStorage.getItem(STORAGE) !== 'false';

function getContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Play a simple synthesized sound.
 * @param {object} opts
 * @param {string} opts.type - 'sine' | 'square' | 'sawtooth' | 'triangle'
 * @param {number} opts.freq - Frequency in Hz
 * @param {number} opts.duration - Duration in seconds
 * @param {number} opts.volume - Volume 0 to 1
 * @param {number} [opts.ramp] - If true, ramp frequency down (slide effect)
 */
function playTone({ type = 'sine', freq = 440, duration = 0.1, volume = 0.1, ramp = 0 }) {
  if (!enabled) return;
  try {
    const ctx = getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (ramp) {
      osc.frequency.exponentialRampToValueAtTime(ramp, ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.warn('Audio feedback failed', e);
  }
}

export const audio = {
  isEnabled: () => enabled,
  setEnabled: (v) => {
    enabled = v;
    localStorage.setItem(STORAGE, v);
    updateToggleUI();
  },

  click: () => playTone({ type: 'sine', freq: 800, duration: 0.05, volume: 0.05 }),
  action: () => playTone({ type: 'triangle', freq: 600, duration: 0.1, volume: 0.08 }),
  success: () => {
    playTone({ type: 'sine', freq: 600, duration: 0.1, volume: 0.08 });
    setTimeout(() => playTone({ type: 'sine', freq: 900, duration: 0.15, volume: 0.08 }), 100);
  },
  error: () => {
    playTone({ type: 'square', freq: 150, duration: 0.1, volume: 0.05 });
    setTimeout(() => playTone({ type: 'square', freq: 120, duration: 0.2, volume: 0.05 }), 120);
  },
  delete: () => {
    playTone({ type: 'sawtooth', freq: 400, duration: 0.2, volume: 0.03, ramp: 50 });
  },
  upload: () => {
    playTone({ type: 'sine', freq: 400, duration: 0.3, volume: 0.05, ramp: 800 });
  }
};

let _toggleContainer = null;

function updateToggleUI() {
  if (!_toggleContainer) return;
  const btn = _toggleContainer.querySelector('.audio-toggle-btn');
  if (btn) {
    btn.classList.toggle('active', enabled);
    btn.querySelector('.audio-toggle-icon').textContent = enabled ? '🔊' : '🔇';
    btn.querySelector('.audio-toggle-text').textContent = enabled ? 'Audio On' : 'Audio Off';
  }
}

/**
 * Renders the audio toggle into containerEl and attaches click handling.
 */
export function renderAudioToggle(containerEl) {
  _toggleContainer = containerEl;
  containerEl.innerHTML = `
    <div class="audio-toggle">
      <button class="btn-ghost btn-sm audio-toggle-btn${enabled ? ' active' : ''}" type="button">
        <span class="audio-toggle-icon">${enabled ? '🔊' : '🔇'}</span>
        <span class="audio-toggle-text">${enabled ? 'Audio On' : 'Audio Off'}</span>
      </button>
    </div>
  `;

  containerEl.addEventListener('click', e => {
    if (e.target.closest('.audio-toggle-btn')) {
      audio.setEnabled(!enabled);
      if (enabled) audio.click();
    }
  });
}

/**
 * Initialize global click listener.
 */
export function initAudioFeedback() {
  window.addEventListener('click', (e) => {
    const target = e.target.closest('button, a, input[type="submit"], .ts-btn, .image-card');
    if (target) {
      audio.click();
    }
  }, { capture: true });
}

