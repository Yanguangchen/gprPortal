# context.md

Living document tracking the current state, decisions, and open questions for the GPR Image Portal.

---

## What This App Does

A construction engineering company uploads Ground Penetrating Radar scan images after each site survey. This portal lets staff:
- Upload a scan image + tag it with company name, project name, and scan date
- Browse all images in a filterable gallery
- Edit metadata (company/project/date) without re-uploading
- Delete records and their associated Storage files
- Secure access via Google Sign-in for authorized personnel only

---

## Current State (as of April 2026)

| Area              | Status                                                                           |
|-------------------|----------------------------------------------------------------------------------|
| UI / layout       | Complete — glassmorphic, responsive cards, sci-fi theme system                   |
| Auth              | **Live** — Google Sign-in implemented with dedicated User Profile card           |
| Security          | **Active** — Firestore & Storage rules restrict access to specific Admin UID      |
| Firebase wiring   | **Live** — USE_FIREBASE = true, real config in js/api.js                         |
| Image compression | Active — client-side JPEG compress (max 1920×1080, q=0.82)                       |
| Deployment        | **Live on Vercel** — https://gpr-portal.vercel.app                               |
| CORS              | Configured — cors.json created to allow uploads from localhost and Vercel domains |
| Error Handling    | Detailed — descriptive errors for permission-denied, storage-quota, etc.         |

---

## Firebase Project

| Setting          | Value                                       |
|------------------|---------------------------------------------|
| Project ID       | `gprportal-49b88`                           |
| Admin UID        | `gV9UDP2O0efmp3YWZiWk5NOXfYm1`              |
| Plan             | **Blaze (Pay-as-you-go)**                   |
| Firestore coll.  | `gpr_images`                                |
| Storage bucket   | `gs://gprportal-49b88.firebasestorage.app`  |

---

## Key Decisions

### Firebase Authentication (V2)
Implemented Google Sign-in to replace the "trusted network" assumption of V1. The app now requires authentication to access any CRUD features. A dedicated `#user-profile` card at the top of the app provides status and login/logout actions.

### UID-Based Security Rules
Access is restricted at the database and storage level via rules that check `request.auth.uid`. The current rules only allow access for the specific administrator UID (`gV9UDP2O0efmp3YWZiWk5NOXfYm1`).

### Static Deployment (Vercel)
The project is hosted on Vercel as a static site. `vercel.json` ensures all paths route to `index.html` (SPA behavior) and explicitly handles static file serving to avoid Node.js misidentification.

### CORS Management
Firebase Storage CORS policy must be manually set via `gsutil` or Google Cloud Shell whenever new origins are added. The current `cors.json` includes `localhost`, `127.0.0.1`, and `gpr-portal.vercel.app`.

### Error Handling System
`js/api.js` contains a mapper that translates technical Firebase error codes into user-friendly messages. These messages are passed through the async/await chain and displayed in component-specific status elements.

---

## Module Responsibilities

| File                  | Responsibility                                                |
|-----------------------|---------------------------------------------------------------|
| `app.js`              | Orchestrator: Init theme, handles Auth flow, wires components |
| `js/api.js`           | Data Layer: Auth, CRUD, dummy shims, error mapping            |
| `js/utils.js`         | Utilities: `esc()`, `formatDate()`, `compressImage()`         |
| `js/theme.js`         | Theme persistence, `initTheme()`, `renderThemeSwitcher()`     |
| `js/Modal.js`         | Generic promise-based modal (form or confirm)                 |
| `js/DropZone.js`      | Drag-drop / browse file picker component                      |
| `js/ImageCard.js`     | UI Function: record → card DOM element                        |
| `js/Gallery.js`       | UI Component: Filter bar, image grid, lightbox                |
| `js/UploadPanel.js`   | UI Component: Upload form panel with DropZone                 |

---

## Deployment & Setup Guide

1.  **Firebase Console**:
    - Enable Authentication (Google)
    - Create Firestore `gpr_images` collection
    - Initialize Storage bucket
    - Add Authorized Domains (Vercel URL)
2.  **CLI / Cloud Shell**:
    - Set Firestore Rules (`firestore.rules`)
    - Set Storage Rules (`storage.rules`)
    - Set Storage CORS (`cors.json`)
3.  **Vercel**:
    - Connect GitHub repo
    - Set Framework Preset to "Other"
    - Deployment automatically picks up `vercel.json`

---

## Known Limitations / Backlog

- **No Multi-user Permissions** — All access is currently restricted to one specific admin UID.
- **No Pagination** — All records loaded at once.
- **PWA icons** — Standard icons referenced in `manifest.json` should be replaced with custom brand assets.
- **CORS propagation** — Changes to `cors.json` can take up to 60 seconds to reflect on the live site.
