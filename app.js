// ══════════════════════════════════════════════════════════════════
//  GPR IMAGE PORTAL  ·  app.js  (orchestrator)
//
//  This file only wires components together.
//  All logic lives in js/*.js modules.
// ══════════════════════════════════════════════════════════════════
import { api, initFirebase, USE_FIREBASE } from './js/api.js';
import { Gallery }     from './js/Gallery.js';
import { UploadPanel } from './js/UploadPanel.js';
import { Modal }       from './js/Modal.js';
import { initTheme, renderThemeSwitcher } from './js/theme.js';
import { audio, initAudioFeedback, renderAudioToggle } from './js/audio.js';

// Apply saved theme immediately (before any rendering) to avoid flash
initTheme();
initAudioFeedback();

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookie(name) {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1];
}

function setCookie(name, value) {
  document.cookie = `${name}=${value}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
}

const EYE_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
`;

const EYE_OFF_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3l18 18"></path>
    <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-1.2"></path>
    <path d="M7.4 7.8C4.5 9.4 2.5 12 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.2-1"></path>
    <path d="M13.7 6.2C18.6 7 21.5 12 21.5 12s-.9 1.6-2.5 3"></path>
  </svg>
`;

function createVisibilityToggle({ target, cookieName, hiddenLabel, visibleLabel, hiddenIcon, visibleIcon }) {
  if (!target) return null;

  const savedValue = getCookie(cookieName);
  let isVisible = savedValue !== 'false';
  if (savedValue === undefined) setCookie(cookieName, 'true');
  let button = null;

  function render() {
    target.classList.toggle('is-collapsed', !isVisible);
    if (!button) return;
    button.innerHTML = isVisible ? hiddenIcon : visibleIcon;
    button.title = isVisible ? hiddenLabel : visibleLabel;
    button.setAttribute('aria-label', isVisible ? hiddenLabel : visibleLabel);
    button.setAttribute('aria-pressed', String(!isVisible));
  }

  function wireButton(nextButton) {
    if (!nextButton) return;
    button = nextButton;
    button.onclick = () => {
      isVisible = !isVisible;
      setCookie(cookieName, String(isVisible));
      render();
    };
    render();
  }

  render();
  return { render, wireButton };
}

async function boot() {
  const headerVisibility = createVisibilityToggle({
    target: document.querySelector('.glass.header'),
    cookieName: 'gpr-header-visible',
    hiddenLabel: 'Hide Header',
    visibleLabel: 'Show Header',
    hiddenIcon: EYE_OFF_ICON,
    visibleIcon: EYE_ICON,
  });
  headerVisibility?.wireButton(document.getElementById('toggle-header'));

  const profileVisibility = createVisibilityToggle({
    target: document.getElementById('user-profile'),
    cookieName: 'gpr-user-profile-visible',
    hiddenLabel: 'Hide Profile',
    visibleLabel: 'Show Profile',
    hiddenIcon: EYE_OFF_ICON,
    visibleIcon: EYE_ICON,
  });

  renderThemeSwitcher(document.getElementById('theme-switcher'));
  renderAudioToggle(document.getElementById('audio-switcher'));

  if (USE_FIREBASE) await initFirebase();


  const userProfileEl = document.getElementById('user-profile');

  // ── Auth modal ─────────────────────────────────────────────────
  const loginModal = new Modal({
    title: 'Authentication Required',
    bodyHTML: `
      <div class="auth-modal-content">
        <p class="modal-body">Please sign in with your Google account to access the portal.</p>
        <button id="google-login-btn" class="btn-primary auth-btn">
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="" width="18" height="18" />
          <span>Sign in with Google</span>
        </button>
      </div>
    `,
    confirmLabel: 'Close',
    confirmVariant: 'ghost',
  });

  // Wire up the login button inside the modal
  const setupLoginBtn = () => {
    const btn = document.getElementById('google-login-btn');
    if (btn) {
      btn.onclick = async () => {
        loginModal.setLoading(true);
        try {
          await api.login();
          audio.success();
          loginModal.close();
        } catch (err) {
          console.error(err);
          audio.error();
          loginModal.setStatus('Login failed. Check console.', 'error');
        } finally {
          loginModal.setLoading(false);
        }
      };
    }
  };

  function renderUserProfile(user) {
    if (!user) {
      userProfileEl.innerHTML = `
        <div class="profile-inner">
          <div class="user-profile">
            <div class="user-info">
              <span class="user-name">Guest</span>
              <span class="user-email">Please sign in to manage scans</span>
            </div>
          </div>
          <div class="auth-card-actions">
            <button id="header-login-btn" class="btn-primary btn-sm">Sign In</button>
          </div>
        </div>
        <button id="toggle-user-profile" class="section-toggle" type="button"></button>
      `;
      profileVisibility?.wireButton(document.getElementById('toggle-user-profile'));
      document.getElementById('header-login-btn').onclick = () => {
        loginModal.open();
        setupLoginBtn();
      };
      return;
    }

    const { displayName, email, photoURL } = user;
    userProfileEl.innerHTML = `
      <div class="profile-inner">
        <div class="user-profile">
          <img class="user-avatar" src="${photoURL || 'https://www.gravatar.com/avatar/000?d=mp'}" alt="" />
          <div class="user-info">
            <span class="user-name">${displayName || 'User'}</span>
            <span class="user-email">${email || ''}</span>
          </div>
        </div>
        <div class="auth-card-actions">
          <button id="header-logout-btn" class="btn-ghost btn-sm">Sign Out</button>
        </div>
      </div>
      <button id="toggle-user-profile" class="section-toggle" type="button"></button>
    `;
    profileVisibility?.wireButton(document.getElementById('toggle-user-profile'));

    document.getElementById('header-logout-btn').onclick = () => {
      audio.action();
      api.logout();
    };
  }

  // Listen for auth changes
  api.onAuth(user => {
    renderUserProfile(user);
    if (!user) {
      loginModal.open();
      setupLoginBtn();
    } else {
      loginModal.close();
    }
  });

  // ── Edit modal ─────────────────────────────────────────────────
  const editModal = new Modal({
    title: 'Edit Record',
    fields: [
      { id: 'companyName', label: 'Company Name', type: 'text' },
      { id: 'projectName', label: 'Project Name', type: 'text' },
      { id: 'workSite',    label: 'Work Site',    type: 'text' },
      { id: 'imageDate',   label: 'Scan Date',    type: 'date' },
    ],
    confirmLabel: 'Save Changes',
    confirmVariant: 'primary',
  });

  // ── Delete confirm modal ───────────────────────────────────────
  const deleteModal = new Modal({
    title: 'Delete Image?',
    bodyHTML: '<p class="modal-body">This will permanently remove the image and its record. This action cannot be undone.</p>',
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    size: 'sm',
  });

  // ── Gallery ────────────────────────────────────────────────────
  const gallery = new Gallery(document.getElementById('gallery-mount'), {

    onEdit: async rec => {
      const values = await editModal.open({
        companyName: rec.companyName,
        projectName: rec.projectName,
        workSite:    rec.workSite,
        imageDate:   rec.imageDate,
      });
      if (!values) return; // cancelled

      const company = values.companyName.trim();
      const project = values.projectName.trim();
      const workSite = values.workSite.trim();
      if (!company) { editModal.setStatus('Company name is required.', 'error'); return; }
      if (!project) { editModal.setStatus('Project name is required.', 'error'); return; }
      if (!workSite) { editModal.setStatus('Work site is required.', 'error'); return; }

      editModal.setLoading(true);
      try {
        const fields = { companyName: company, projectName: project, workSite, imageDate: values.imageDate };
        await api.update(rec.id, fields);
        gallery.updateRecord(rec.id, fields);
        audio.success();
        editModal.close();
      } catch (err) {
        audio.error();
        editModal.setStatus(err.message || 'Save failed. Check console.', 'error');
      } finally {
        editModal.setLoading(false);
      }
    },

    onDelete: async rec => {
      const confirmed = await deleteModal.open();
      if (!confirmed) return; // cancelled

      deleteModal.setLoading(true);
      try {
        await api.delete(rec.id, rec.storagePath);
        gallery.removeRecord(rec.id);
        audio.delete();
        deleteModal.close();
      } catch (err) {
        audio.error();
        deleteModal.setStatus(err.message || 'Delete failed. Check console.', 'error');
      } finally {
        deleteModal.setLoading(false);
      }
    },
  });

  // ── Upload panel ───────────────────────────────────────────────
  new UploadPanel(document.getElementById('upload-mount'), {
    onUpload: async (file, meta, onProgress) => {
      const rec = await api.create(file, meta, onProgress);
      gallery.addRecord(rec);
      return rec;
    },
  });

  // ── Initial data load ──────────────────────────────────────────
  gallery.setRecords(await api.fetchAll());
}

boot().catch(console.error);

