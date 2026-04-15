// ══════════════════════════════════════════════════════════════════
//  GPR IMAGE PORTAL  ·  app.js
//  Runs on dummy data by default.
//  Swap in the Firebase section below to go live.
// ══════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// 1.  FIREBASE CONFIGURATION
//     Replace the placeholder values with your
//     actual Firebase project credentials, then
//     set USE_FIREBASE = true.
// ──────────────────────────────────────────────
const USE_FIREBASE = false; // ← flip to true once config is filled

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// Firebase module references (populated when USE_FIREBASE = true)
let db, storage;

async function initFirebase() {
  const { initializeApp }         = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp }
                                  = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject }
                                  = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");

  const app = initializeApp(firebaseConfig);
  db      = getFirestore(app);
  storage = getStorage(app);

  // Expose Firestore helpers globally so CRUD functions can use them
  window._fb = {
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
    ref, uploadBytesResumable, getDownloadURL, deleteObject,
  };
}

// ──────────────────────────────────────────────
// 2.  DUMMY DATA  (used when USE_FIREBASE = false)
// ──────────────────────────────────────────────
let dummyRecords = [
  {
    id: "d1",
    companyName:  "Apex Surveys Ltd.",
    projectName:  "Bridge Deck Inspection — I-90",
    imageDate:    "2024-11-03",
    imageUrl:     "https://picsum.photos/seed/gpr1/640/400",
    imageName:    "bridge_deck_scan_01.jpg",
    storagePath:  null,
  },
  {
    id: "d2",
    companyName:  "UrbanCore Engineering",
    projectName:  "Downtown Utility Mapping",
    imageDate:    "2024-12-18",
    imageUrl:     "https://picsum.photos/seed/gpr2/640/400",
    imageName:    "utility_map_core_02.png",
    storagePath:  null,
  },
  {
    id: "d3",
    companyName:  "Apex Surveys Ltd.",
    projectName:  "Airport Runway Subsurface",
    imageDate:    "2025-01-07",
    imageUrl:     "https://picsum.photos/seed/gpr3/640/400",
    imageName:    "runway_subsurface_03.jpg",
    storagePath:  null,
  },
  {
    id: "d4",
    companyName:  "TerraScan Inc.",
    projectName:  "Highway 101 Rebar Detection",
    imageDate:    "2025-02-14",
    imageUrl:     "https://picsum.photos/seed/gpr4/640/400",
    imageName:    "rebar_hwy101_04.jpg",
    storagePath:  null,
  },
  {
    id: "d5",
    companyName:  "UrbanCore Engineering",
    projectName:  "Sewer Tunnel Assessment",
    imageDate:    "2025-03-01",
    imageUrl:     "https://picsum.photos/seed/gpr5/640/400",
    imageName:    "sewer_tunnel_05.png",
    storagePath:  null,
  },
  {
    id: "d6",
    companyName:  "TerraScan Inc.",
    projectName:  "Parking Deck Void Survey",
    imageDate:    "2025-03-22",
    imageUrl:     "https://picsum.photos/seed/gpr6/640/400",
    imageName:    "parking_void_06.jpg",
    storagePath:  null,
  },
];

let _nextDummyId = 7;

// ──────────────────────────────────────────────
// 3.  FIREBASE CRUD FUNCTIONS
//     These are wired to Firestore + Storage.
//     They are called automatically when
//     USE_FIREBASE = true.
// ──────────────────────────────────────────────

/** Fetch all records from Firestore */
async function fb_fetchAll() {
  const { collection, getDocs } = window._fb;
  const snap = await getDocs(collection(db, "gpr_images"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Upload image file to Firebase Storage, then save metadata to Firestore.
 * @param {File}   file
 * @param {Object} meta  { companyName, projectName, imageDate }
 * @param {function} onProgress  callback(0-100)
 * @returns {Promise<Object>} saved record
 */
async function fb_create(file, meta, onProgress) {
  const { addDoc, collection, serverTimestamp, ref, uploadBytesResumable, getDownloadURL } = window._fb;

  const storagePath = `gpr_images/${Date.now()}_${file.name}`;
  const storageRef  = ref(storage, storagePath);
  const uploadTask  = uploadBytesResumable(storageRef, file);

  // Wait for upload, stream progress
  await new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      snap => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject,
      resolve,
    );
  });

  const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);

  const docRef = await addDoc(collection(db, "gpr_images"), {
    companyName:  meta.companyName,
    projectName:  meta.projectName,
    imageDate:    meta.imageDate,
    imageUrl,
    imageName:    file.name,
    storagePath,
    createdAt:    serverTimestamp(),
  });

  return { id: docRef.id, companyName: meta.companyName, projectName: meta.projectName,
           imageDate: meta.imageDate, imageUrl, imageName: file.name, storagePath };
}

/**
 * Update metadata fields on an existing Firestore document.
 * @param {string} id
 * @param {Object} fields  { companyName, projectName, imageDate }
 */
async function fb_update(id, fields) {
  const { doc, updateDoc } = window._fb;
  await updateDoc(doc(db, "gpr_images", id), fields);
}

/**
 * Delete a Firestore document and its corresponding Storage file.
 * @param {string} id
 * @param {string} storagePath
 */
async function fb_delete(id, storagePath) {
  const { doc, deleteDoc, ref, deleteObject } = window._fb;
  if (storagePath) {
    try { await deleteObject(ref(storage, storagePath)); }
    catch (_) { /* file may already be gone */ }
  }
  await deleteDoc(doc(db, "gpr_images", id));
}

// ──────────────────────────────────────────────
// 4.  DUMMY CRUD SHIMS  (mirror Firebase API)
//     Simulate async delays so the UI feedback
//     works identically to live mode.
// ──────────────────────────────────────────────

async function dummy_fetchAll() {
  return [...dummyRecords];
}

async function dummy_create(file, meta, onProgress) {
  for (let p = 0; p <= 100; p += 20) {
    await delay(80);
    onProgress(p);
  }
  const objectUrl = URL.createObjectURL(file);
  const record = {
    id:           `d${_nextDummyId++}`,
    companyName:  meta.companyName,
    projectName:  meta.projectName,
    imageDate:    meta.imageDate,
    imageUrl:     objectUrl,
    imageName:    file.name,
    storagePath:  null,
  };
  dummyRecords.unshift(record);
  return record;
}

async function dummy_update(id, fields) {
  await delay(300);
  const rec = dummyRecords.find(r => r.id === id);
  if (rec) Object.assign(rec, fields);
}

async function dummy_delete(id) {
  await delay(300);
  dummyRecords = dummyRecords.filter(r => r.id !== id);
}

// Route to Firebase or dummy based on flag
const api = {
  fetchAll: () => USE_FIREBASE ? fb_fetchAll()             : dummy_fetchAll(),
  create:   (...a) => USE_FIREBASE ? fb_create(...a)       : dummy_create(...a),
  update:   (...a) => USE_FIREBASE ? fb_update(...a)       : dummy_update(...a),
  delete:   (...a) => USE_FIREBASE ? fb_delete(...a)       : dummy_delete(...a),
};

// ──────────────────────────────────────────────
// 5.  APP STATE
// ──────────────────────────────────────────────
let allRecords   = [];   // master list from Firestore / dummy
let selectedFile = null; // file chosen in upload area

const state = {
  filterCompany:  "",
  filterProject:  "",
  filterDateFrom: "",
  filterDateTo:   "",
  filterSearch:   "",
};

// ──────────────────────────────────────────────
// 6.  DOM REFERENCES
// ──────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dropZone       = $("dropZone");
const dropZoneInner  = $("dropZoneInner");
const fileInput      = $("fileInput");
const browseBtn      = $("browseBtn");
const previewImg     = $("previewImg");
const fileNameEl     = $("fileName");
const companyInput   = $("companyName");
const projectInput   = $("projectName");
const datePicker     = $("imageDate");
const uploadBtn      = $("uploadBtn");
const uploadBtnText  = $("uploadBtnText");
const uploadSpinner  = $("uploadSpinner");
const uploadStatus   = $("uploadStatus");

const filterCompany  = $("filterCompany");
const filterProject  = $("filterProject");
const filterDateFrom = $("filterDateFrom");
const filterDateTo   = $("filterDateTo");
const filterSearch   = $("filterSearch");
const clearFiltersBtn= $("clearFiltersBtn");
const galleryGrid    = $("galleryGrid");
const galleryCount   = $("galleryCount");
const emptyState     = $("emptyState");

const lightbox       = $("lightbox");
const lightboxImg    = $("lightboxImg");
const lightboxMeta   = $("lightboxMeta");
const lightboxClose  = $("lightboxClose");
const lightboxBackdrop = $("lightboxBackdrop");

const editModal      = $("editModal");
const editId         = $("editId");
const editCompany    = $("editCompany");
const editProject    = $("editProject");
const editDate       = $("editDate");
const editCancelBtn  = $("editCancelBtn");
const editSaveBtn    = $("editSaveBtn");
const editSaveBtnText= $("editSaveBtnText");
const editSpinner    = $("editSpinner");
const editStatus     = $("editStatus");
const editModalBackdrop = $("editModalBackdrop");

const deleteModal    = $("deleteModal");
const deleteId       = $("deleteId");
const deleteStoragePath = $("deleteStoragePath");
const deleteCancelBtn= $("deleteCancelBtn");
const deleteConfirmBtn = $("deleteConfirmBtn");
const deleteBtnText  = $("deleteBtnText");
const deleteSpinner  = $("deleteSpinner");
const deleteStatus   = $("deleteStatus");
const deleteModalBackdrop = $("deleteModalBackdrop");

// ──────────────────────────────────────────────
// 7.  UPLOAD / DROP ZONE
// ──────────────────────────────────────────────
browseBtn.addEventListener("click", e => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener("click",  () => fileInput.click());

dropZone.addEventListener("dragover", e => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", e => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) setSelectedFile(file);
});

fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setSelectedFile(fileInput.files[0]);
});

function setSelectedFile(file) {
  selectedFile = file;
  fileNameEl.textContent = file.name;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.hidden = false;
  dropZoneInner.style.display = "none";
}

// ──────────────────────────────────────────────
// 8.  UPLOAD SUBMIT
// ──────────────────────────────────────────────
uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) { setUploadStatus("Please select an image file.", "error"); return; }
  if (!companyInput.value.trim()) { setUploadStatus("Company name is required.", "error"); return; }
  if (!projectInput.value.trim()) { setUploadStatus("Project name is required.", "error"); return; }
  if (!datePicker.value)          { setUploadStatus("Scan date is required.", "error"); return; }

  setUploading(true);
  setUploadStatus("Uploading…", "");

  try {
    const record = await api.create(
      selectedFile,
      {
        companyName: companyInput.value.trim(),
        projectName: projectInput.value.trim(),
        imageDate:   datePicker.value,
      },
      pct => setUploadStatus(`Uploading… ${pct}%`, ""),
    );

    allRecords.unshift(record);
    rebuildFilterDropdowns();
    renderGallery();
    resetUploadForm();
    setUploadStatus("Image uploaded successfully.", "success");
  } catch (err) {
    console.error(err);
    setUploadStatus("Upload failed. Check console for details.", "error");
  } finally {
    setUploading(false);
  }
});

function setUploading(on) {
  uploadBtn.disabled   = on;
  uploadBtnText.hidden = on;
  uploadSpinner.hidden = !on;
}

function setUploadStatus(msg, type) {
  uploadStatus.textContent = msg;
  uploadStatus.className   = `upload-status ${type}`;
}

function resetUploadForm() {
  selectedFile = null;
  fileInput.value = "";
  companyInput.value = "";
  projectInput.value = "";
  datePicker.value = "";
  previewImg.hidden = true;
  previewImg.src = "";
  dropZoneInner.style.display = "";
  fileNameEl.textContent = "";
}

// ──────────────────────────────────────────────
// 9.  GALLERY RENDER
// ──────────────────────────────────────────────
function renderGallery() {
  const filtered = filterRecords();

  galleryCount.textContent = `${filtered.length} image${filtered.length !== 1 ? "s" : ""} shown`;
  galleryGrid.innerHTML    = "";

  if (filtered.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  filtered.forEach(rec => {
    const card = buildCard(rec);
    galleryGrid.appendChild(card);
  });
}

function buildCard(rec) {
  const card = document.createElement("div");
  card.className = "image-card";
  card.dataset.id = rec.id;

  const formattedDate = rec.imageDate
    ? new Date(rec.imageDate + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";

  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${esc(rec.imageUrl)}" alt="${esc(rec.imageName)}" loading="lazy" />
      <div class="card-overlay"></div>
      <span class="card-badge">GPR</span>
    </div>
    <div class="card-body">
      <div class="card-company">${esc(rec.companyName)}</div>
      <div class="card-project">${esc(rec.projectName)}</div>
      <div class="card-date">${formattedDate}</div>
    </div>
    <div class="card-actions">
      <button class="card-btn card-btn-edit"   data-id="${esc(rec.id)}">Edit</button>
      <button class="card-btn card-btn-delete" data-id="${esc(rec.id)}">Delete</button>
    </div>
  `;

  // Click image → lightbox
  card.querySelector(".card-img-wrap").addEventListener("click", () => openLightbox(rec));

  // Edit / Delete buttons
  card.querySelector(".card-btn-edit").addEventListener("click", e => {
    e.stopPropagation();
    openEditModal(rec);
  });
  card.querySelector(".card-btn-delete").addEventListener("click", e => {
    e.stopPropagation();
    openDeleteModal(rec);
  });

  return card;
}

// ──────────────────────────────────────────────
// 10.  FILTER LOGIC
// ──────────────────────────────────────────────
function filterRecords() {
  const company  = filterCompany.value.trim().toLowerCase();
  const project  = filterProject.value.trim().toLowerCase();
  const dateFrom = filterDateFrom.value;
  const dateTo   = filterDateTo.value;
  const search   = filterSearch.value.trim().toLowerCase();

  return allRecords.filter(r => {
    if (company  && r.companyName.toLowerCase() !== company)   return false;
    if (project  && r.projectName.toLowerCase() !== project)   return false;
    if (dateFrom && r.imageDate < dateFrom)                    return false;
    if (dateTo   && r.imageDate > dateTo)                      return false;
    if (search) {
      const hay = `${r.companyName} ${r.projectName} ${r.imageName}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

// Rebuild company / project dropdown options from current master list
function rebuildFilterDropdowns() {
  const companies = [...new Set(allRecords.map(r => r.companyName))].sort();
  const projects  = [...new Set(allRecords.map(r => r.projectName))].sort();

  const prevCompany = filterCompany.value;
  const prevProject = filterProject.value;

  filterCompany.innerHTML = '<option value="">All Companies</option>' +
    companies.map(c => `<option value="${esc(c.toLowerCase())}">${esc(c)}</option>`).join("");

  filterProject.innerHTML = '<option value="">All Projects</option>' +
    projects.map(p => `<option value="${esc(p.toLowerCase())}">${esc(p)}</option>`).join("");

  filterCompany.value = prevCompany;
  filterProject.value = prevProject;
}

[filterCompany, filterProject, filterDateFrom, filterDateTo, filterSearch]
  .forEach(el => el.addEventListener("input", renderGallery));

clearFiltersBtn.addEventListener("click", () => {
  filterCompany.value  = "";
  filterProject.value  = "";
  filterDateFrom.value = "";
  filterDateTo.value   = "";
  filterSearch.value   = "";
  renderGallery();
});

// ──────────────────────────────────────────────
// 11.  LIGHTBOX
// ──────────────────────────────────────────────
function openLightbox(rec) {
  lightboxImg.src = rec.imageUrl;
  lightboxMeta.innerHTML =
    `<strong>${esc(rec.companyName)}</strong> · ${esc(rec.projectName)}<br/>` +
    (rec.imageDate ? new Date(rec.imageDate + "T00:00:00").toLocaleDateString("en-US", { dateStyle: "long" }) : "");
  lightbox.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  lightbox.hidden = true;
  lightboxImg.src = "";
  document.body.style.overflow = "";
}

lightboxClose.addEventListener("click",    closeLightbox);
lightboxBackdrop.addEventListener("click", closeLightbox);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!lightbox.hidden)  closeLightbox();
    if (!editModal.hidden)   closeEditModal();
    if (!deleteModal.hidden) closeDeleteModal();
  }
});

// ──────────────────────────────────────────────
// 12.  EDIT MODAL
// ──────────────────────────────────────────────
function openEditModal(rec) {
  editId.value      = rec.id;
  editCompany.value = rec.companyName;
  editProject.value = rec.projectName;
  editDate.value    = rec.imageDate || "";
  editStatus.textContent = "";
  editModal.hidden = false;
  document.body.style.overflow = "hidden";
  editCompany.focus();
}

function closeEditModal() {
  editModal.hidden = true;
  document.body.style.overflow = "";
}

editCancelBtn.addEventListener("click",    closeEditModal);
editModalBackdrop.addEventListener("click", closeEditModal);

editSaveBtn.addEventListener("click", async () => {
  const id = editId.value;
  if (!editCompany.value.trim()) { setEditStatus("Company name is required.", "error"); return; }
  if (!editProject.value.trim()) { setEditStatus("Project name is required.", "error"); return; }

  setEditSaving(true);

  const fields = {
    companyName: editCompany.value.trim(),
    projectName: editProject.value.trim(),
    imageDate:   editDate.value,
  };

  try {
    await api.update(id, fields);
    const rec = allRecords.find(r => r.id === id);
    if (rec) Object.assign(rec, fields);
    rebuildFilterDropdowns();
    renderGallery();
    closeEditModal();
  } catch (err) {
    console.error(err);
    setEditStatus("Save failed. Check console.", "error");
  } finally {
    setEditSaving(false);
  }
});

function setEditSaving(on) {
  editSaveBtn.disabled    = on;
  editSaveBtnText.hidden  = on;
  editSpinner.hidden      = !on;
}

function setEditStatus(msg, type) {
  editStatus.textContent = msg;
  editStatus.className   = `upload-status ${type}`;
}

// ──────────────────────────────────────────────
// 13.  DELETE MODAL
// ──────────────────────────────────────────────
function openDeleteModal(rec) {
  deleteId.value          = rec.id;
  deleteStoragePath.value = rec.storagePath || "";
  deleteStatus.textContent = "";
  deleteModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeDeleteModal() {
  deleteModal.hidden = true;
  document.body.style.overflow = "";
}

deleteCancelBtn.addEventListener("click",     closeDeleteModal);
deleteModalBackdrop.addEventListener("click", closeDeleteModal);

deleteConfirmBtn.addEventListener("click", async () => {
  const id          = deleteId.value;
  const storagePath = deleteStoragePath.value;

  setDeleting(true);

  try {
    await api.delete(id, storagePath);
    allRecords = allRecords.filter(r => r.id !== id);
    rebuildFilterDropdowns();
    renderGallery();
    closeDeleteModal();
  } catch (err) {
    console.error(err);
    deleteStatus.textContent = "Delete failed. Check console.";
    deleteStatus.className   = "upload-status error";
  } finally {
    setDeleting(false);
  }
});

function setDeleting(on) {
  deleteConfirmBtn.disabled = on;
  deleteBtnText.hidden      = on;
  deleteSpinner.hidden      = !on;
}

// ──────────────────────────────────────────────
// 14.  HELPERS
// ──────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Escape HTML to prevent XSS when inserting user strings into innerHTML */
function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ──────────────────────────────────────────────
// 15.  BOOT
// ──────────────────────────────────────────────
async function boot() {
  if (USE_FIREBASE) {
    await initFirebase();
  }

  allRecords = await api.fetchAll();
  rebuildFilterDropdowns();
  renderGallery();
}

boot().catch(console.error);
