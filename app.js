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

async function boot() {
  if (USE_FIREBASE) await initFirebase();

  // ── Edit modal ─────────────────────────────────────────────────
  const editModal = new Modal({
    title: 'Edit Record',
    fields: [
      { id: 'companyName', label: 'Company Name', type: 'text' },
      { id: 'projectName', label: 'Project Name', type: 'text' },
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
        imageDate:   rec.imageDate,
      });
      if (!values) return; // cancelled

      const company = values.companyName.trim();
      const project = values.projectName.trim();
      if (!company) { editModal.setStatus('Company name is required.', 'error'); return; }
      if (!project) { editModal.setStatus('Project name is required.', 'error'); return; }

      editModal.setLoading(true);
      try {
        const fields = { companyName: company, projectName: project, imageDate: values.imageDate };
        await api.update(rec.id, fields);
        gallery.updateRecord(rec.id, fields);
        editModal.close();
      } catch (err) {
        console.error(err);
        editModal.setStatus('Save failed. Check console.', 'error');
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
        deleteModal.close();
      } catch (err) {
        console.error(err);
        deleteModal.setStatus('Delete failed. Check console.', 'error');
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
