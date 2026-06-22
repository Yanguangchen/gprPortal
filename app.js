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


async function boot() {
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
        <button id="header-login-btn" class="btn-primary btn-sm">Sign In</button>
      `;
      document.getElementById('header-login-btn').onclick = () => {
        loginModal.open();
        setupLoginBtn();
      };
      return;
    }

    const { displayName, email, photoURL } = user;
    userProfileEl.innerHTML = `
      <div class="userchip">
        <img class="avatar"
             src="${photoURL || 'https://www.gravatar.com/avatar/000?d=mp'}"
             alt="${displayName || 'User'}" />
        <span class="ui">
          <span class="un">${displayName || 'User'}</span>
          <span class="ue">${email || ''}</span>
        </span>
      </div>
      <button id="header-logout-btn" class="btn-ghost btn-sm">Sign Out</button>
    `;

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

