/**
 * theme.js — Four-theme switcher with sci-fi sliding pill UI.
 * Themes: ocean | dark | light | high-contrast
 * Persists choice to localStorage.
 */

const THEMES  = ['ocean', 'dark', 'light', 'high-contrast'];
const LABELS  = ['🌊 Ocean', '● Dark', '☀ Light', '◑ HC'];
const STORAGE = 'gpr-theme';

function saved() {
  return localStorage.getItem(STORAGE) || 'ocean';
}

function applyTheme(theme, switcherEl) {
  const idx = THEMES.indexOf(theme);
  if (idx === -1) return;

  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE, theme);

  if (switcherEl) {
    switcherEl.style.setProperty('--thumb-idx', idx);
    switcherEl.querySelectorAll('.ts-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === idx);
    });
  }
}

/**
 * Call once before rendering — sets data-theme immediately to avoid flash.
 */
export function initTheme() {
  document.documentElement.setAttribute('data-theme', saved());
}

/**
 * Renders the theme switcher into containerEl and attaches click handling.
 */
export function renderThemeSwitcher(containerEl) {
  const currentIdx = THEMES.indexOf(saved());

  containerEl.innerHTML = `
    <div class="theme-switcher" style="--thumb-idx:${currentIdx}">
      <div class="ts-track">
        <div class="ts-scan-line"></div>
        <div class="ts-thumb">
          <div class="ts-thumb-scan"></div>
          <div class="ts-particles">
            <span class="ts-particle"></span>
            <span class="ts-particle"></span>
            <span class="ts-particle"></span>
          </div>
          <div class="ts-rings">
            <span class="ts-ring"></span>
            <span class="ts-ring"></span>
            <span class="ts-ring"></span>
          </div>
        </div>
        ${THEMES.map((t, i) => `
          <button class="ts-btn${i === currentIdx ? ' active' : ''}"
                  data-theme="${t}" type="button" aria-label="${t} theme">
            ${LABELS[i]}
          </button>
        `).join('')}
      </div>
      <span class="ts-label">Display Mode</span>
    </div>
  `;

  const switcher = containerEl.querySelector('.theme-switcher');
  containerEl.addEventListener('click', e => {
    const btn = e.target.closest('.ts-btn');
    if (btn) applyTheme(btn.dataset.theme, switcher);
  });
}
