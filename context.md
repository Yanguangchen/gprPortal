# context.md

Living document tracking the current state, decisions, and open questions for the GPR Image Portal.

---

## What This App Does

A construction engineering company uploads Ground Penetrating Radar scan images after each site survey. This portal lets staff:
- Upload a scan image + tag it with company name, project name, and scan date
- Browse all images in a filterable gallery
- Edit metadata (company/project/date) without re-uploading
- Delete records and their associated Storage files

No authentication — the app is intended for internal use on a trusted network.

---

## Current State (as of April 2025)

| Area            | Status                                                   |
|-----------------|----------------------------------------------------------|
| UI / layout     | Complete — dark glassmorphic, responsive                 |
| Dummy data mode | Working — `USE_FIREBASE = false` in `js/api.js`          |
| Firebase wiring | Code complete, untested — needs real `firebaseConfig`    |
| PWA / icons     | `manifest.json` wired; icon images (`favicon.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) must be supplied |
| Auth            | Not implemented — out of scope for V1                    |
| Pagination      | Not implemented — all records loaded at once             |

---

## Key Decisions

### Why no framework
The customer's IT team deploys static files. No Node, no build pipeline, no server-side dependencies. The app must open directly from a file server or `file://`. ES modules in modern browsers satisfy this constraint without any bundling.

### USE_FIREBASE flag
A single boolean in `js/api.js` routes every data call through either the live Firebase functions (`fb_*`) or local dummy shims (`dummy_*`). The dummy shims mirror the same async signature, so UI code never needs to know which backend it's talking to. Switching to live Firebase requires only:
1. Filling in `firebaseConfig` values
2. Flipping `USE_FIREBASE = true`

### Modal as a promise
`Modal.open()` returns a `Promise` that resolves with field values on confirm, `null` on cancel. The modal stays open after confirm — the caller sets `modal.setLoading(true)`, does async work, then calls `modal.close()` on success or `modal.setStatus()` on error. This keeps all business logic in `app.js`, not inside the modal component.

### No separate filter state
`Gallery._filter()` reads directly from the filter DOM inputs on every `_render()` call. There is no duplicated filter-state object — the DOM inputs are the state.

---

## Module Responsibilities

| File                  | Responsibility                                           |
|-----------------------|----------------------------------------------------------|
| `app.js`              | Boot, instantiate components, wire events to api         |
| `js/api.js`           | All data I/O — Firebase + dummy shims, `USE_FIREBASE` flag |
| `js/utils.js`         | `esc()`, `formatDate()`, `delay()`                       |
| `js/Modal.js`         | Generic promise-based modal (form or confirm)            |
| `js/DropZone.js`      | Drag-drop / browse file picker component                 |
| `js/ImageCard.js`     | Pure function: record → card DOM element                 |
| `js/Gallery.js`       | Filter bar, grid render, lightbox, record state          |
| `js/UploadPanel.js`   | Upload form panel, owns DropZone instance                |

---

## How to Add a New Field

1. Add the field to Firestore schema (update `CLAUDE.md` table)
2. Add it to `fb_create` / `dummy_create` in `js/api.js`
3. Add a `field-group` input in `UploadPanel.js` and pass the value through `onUpload`
4. Add it to the `editModal` fields array in `app.js`
5. Render it in `ImageCard.js` if it should appear on cards

---

## Known Limitations / Backlog

- **No pagination** — `getDocs` fetches the entire collection. Will need Firestore query cursors once the collection grows large.
- **No Firebase auth** — any user on the network can create, edit, or delete records.
- **No image type validation beyond `accept="image/*"`** — malformed files will upload but may not render.
- **Object URLs for dummy uploads** are revoked when the page reloads — dummy-uploaded images won't persist between sessions (expected; dummy mode is dev-only).
- **PWA icons** — `manifest.json` is wired but the icon PNG files (`favicon.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) must be provided before installing to homescreen.

---

## Firebase Setup Checklist

- [ ] Create a Firebase project at console.firebase.google.com
- [ ] Enable Firestore (start in test mode or add security rules)
- [ ] Enable Storage (start in test mode or add security rules)
- [ ] Copy the web app config into `js/api.js` → `firebaseConfig`
- [ ] Set `USE_FIREBASE = true` in `js/api.js`
- [ ] Add Firestore security rule: require `auth != null` if auth is added later
- [ ] Add Storage CORS config if serving from a custom domain
