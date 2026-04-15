// ─────────────────────────────────────────────────────────────────
//  DATA LAYER  ·  Firebase Firestore + Storage, with dummy shims
//
//  Set USE_FIREBASE = true and fill firebaseConfig to go live.
//  All four api.* methods work identically in both modes.
// ─────────────────────────────────────────────────────────────────
import { delay } from './utils.js';

export const USE_FIREBASE = false; // ← flip to true once config is filled

export const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT_ID',
  storageBucket:     'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
};

let db, storage;

export async function initFirebase() {
  const { initializeApp } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
  const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
  const { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } =
    await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');

  const app = initializeApp(firebaseConfig);
  db      = getFirestore(app);
  storage = getStorage(app);

  // Bundle helpers on window so CRUD fns can access them without re-importing
  window._fb = {
    collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
    ref, uploadBytesResumable, getDownloadURL, deleteObject,
  };
}

// ── Firebase CRUD ─────────────────────────────────────────────────

async function fb_fetchAll() {
  const { collection, getDocs } = window._fb;
  const snap = await getDocs(collection(db, 'gpr_images'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function fb_create(file, meta, onProgress) {
  const { addDoc, collection, serverTimestamp, ref, uploadBytesResumable, getDownloadURL } = window._fb;

  const storagePath = `gpr_images/${Date.now()}_${file.name}`;
  const uploadTask  = uploadBytesResumable(ref(storage, storagePath), file);

  await new Promise((resolve, reject) => {
    uploadTask.on('state_changed',
      snap => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      reject, resolve,
    );
  });

  const imageUrl = await getDownloadURL(uploadTask.snapshot.ref);
  const docRef   = await addDoc(collection(db, 'gpr_images'), {
    ...meta, imageUrl, imageName: file.name, storagePath, createdAt: serverTimestamp(),
  });

  return { id: docRef.id, ...meta, imageUrl, imageName: file.name, storagePath };
}

async function fb_update(id, fields) {
  const { doc, updateDoc } = window._fb;
  await updateDoc(doc(db, 'gpr_images', id), fields);
}

async function fb_delete(id, storagePath) {
  const { doc, deleteDoc, ref, deleteObject } = window._fb;
  if (storagePath) {
    try { await deleteObject(ref(storage, storagePath)); } catch (_) { /* already gone */ }
  }
  await deleteDoc(doc(db, 'gpr_images', id));
}

// ── Dummy shims ───────────────────────────────────────────────────

let _records = [
  { id: 'd1', companyName: 'Apex Surveys Ltd.',    projectName: 'Bridge Deck Inspection — I-90',  imageDate: '2024-11-03', imageUrl: 'https://picsum.photos/seed/gpr1/640/400', imageName: 'bridge_deck_scan_01.jpg',  storagePath: null },
  { id: 'd2', companyName: 'UrbanCore Engineering', projectName: 'Downtown Utility Mapping',        imageDate: '2024-12-18', imageUrl: 'https://picsum.photos/seed/gpr2/640/400', imageName: 'utility_map_core_02.png',  storagePath: null },
  { id: 'd3', companyName: 'Apex Surveys Ltd.',    projectName: 'Airport Runway Subsurface',       imageDate: '2025-01-07', imageUrl: 'https://picsum.photos/seed/gpr3/640/400', imageName: 'runway_subsurface_03.jpg', storagePath: null },
  { id: 'd4', companyName: 'TerraScan Inc.',        projectName: 'Highway 101 Rebar Detection',    imageDate: '2025-02-14', imageUrl: 'https://picsum.photos/seed/gpr4/640/400', imageName: 'rebar_hwy101_04.jpg',      storagePath: null },
  { id: 'd5', companyName: 'UrbanCore Engineering', projectName: 'Sewer Tunnel Assessment',         imageDate: '2025-03-01', imageUrl: 'https://picsum.photos/seed/gpr5/640/400', imageName: 'sewer_tunnel_05.png',      storagePath: null },
  { id: 'd6', companyName: 'TerraScan Inc.',        projectName: 'Parking Deck Void Survey',       imageDate: '2025-03-22', imageUrl: 'https://picsum.photos/seed/gpr6/640/400', imageName: 'parking_void_06.jpg',      storagePath: null },
];
let _nextId = 7;

async function dummy_fetchAll() { return [..._records]; }

async function dummy_create(file, meta, onProgress) {
  for (let p = 0; p <= 100; p += 20) { await delay(80); onProgress(p); }
  const rec = { id: `d${_nextId++}`, ...meta, imageUrl: URL.createObjectURL(file), imageName: file.name, storagePath: null };
  _records.unshift(rec);
  return rec;
}

async function dummy_update(id, fields) {
  await delay(300);
  const rec = _records.find(r => r.id === id);
  if (rec) Object.assign(rec, fields);
}

async function dummy_delete(id) {
  await delay(300);
  _records = _records.filter(r => r.id !== id);
}

// ── Unified API (the only export callers should use) ──────────────

export const api = {
  fetchAll: ()     => USE_FIREBASE ? fb_fetchAll()     : dummy_fetchAll(),
  create:   (...a) => USE_FIREBASE ? fb_create(...a)   : dummy_create(...a),
  update:   (...a) => USE_FIREBASE ? fb_update(...a)   : dummy_update(...a),
  delete:   (...a) => USE_FIREBASE ? fb_delete(...a)   : dummy_delete(...a),
};
