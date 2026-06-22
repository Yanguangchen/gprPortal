# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GPR Image Portal — a secure CRUD web application for a construction engineering company to manage Ground Penetrating Radar (GPR) scan images. Single-page app with no build step.

## Tech Stack

- **Frontend**: Pure HTML5, plain CSS3, Vanilla JavaScript (ES modules, no bundler)
- **Database**: Firebase Firestore (NoSQL, collection: `gpr_images`)
- **File Storage**: Firebase Storage (`gpr_images/` path prefix)
- **Auth**: Firebase Authentication (Google Sign-in)
- **No frameworks, no npm, no build step** — open `index.html` directly in a browser or serve with any static file server

## Running Locally

```bash
# Any static file server works. Examples:
python3 -m http.server 8080
npx serve .
```

Open `http://localhost:8080` in a browser. The app runs with Firebase by default. If Firebase is disabled, local records use an empty in-memory store.

## Firebase Setup

To connect to a live Firebase project:

1. Replace placeholder values in `app.js` → `firebaseConfig` object
2. Set `USE_FIREBASE = true` at the top of `app.js`
3. Firebase SDKs are loaded at runtime via CDN (v10.12.2) — no install required

### Project Info
- **Project ID**: `gprportal-49b88`
- **Admin UID**: `gV9UDP2O0efmp3YWZiWk5NOXfYm1` (Hardcoded in rules)
- **Plan**: Blaze (Pay-as-you-go)

## Firestore Schema (`gpr_images` collection)

| Field         | Type      | Notes                              |
|---------------|-----------|------------------------------------|
| `companyName` | string    |                                    |
| `projectName` | string    |                                    |
| `workSite`    | string    | Work site/location text            |
| `imageDate`   | string    | ISO date `YYYY-MM-DD`              |
| `imageUrl`    | string    | Firebase Storage download URL      |
| `imageName`   | string    | Original filename                  |
| `storagePath` | string    | Storage path for deletion          |
| `createdAt`   | timestamp | `serverTimestamp()` on create      |

## File Structure

```
index.html          – Shell: header + user-profile + upload-mount + gallery-mount
style.css           – Glassmorphism cards, responsive grid, theme system, auth UI
app.js              – Orchestrator: wires api → components, handles Auth flow
manifest.json       – PWA manifest (standalone fullscreen, theme #060a12)
vercel.json         – Vercel deployment config for static files
firestore.rules     – Access control rules (UID-based)
storage.rules       – Storage access control rules (UID-based)
cors.json           – Firebase Storage CORS configuration
js/
  api.js            – Data layer: Auth (Google), Firestore, Storage, dummy shims
  utils.js          – esc(), formatDate(), compressImage(), delay()
  Modal.js          – Generic promise-based modal class
  DropZone.js       – Drag-drop / click-to-browse file picker
  ImageCard.js      – Pure function: buildCard(rec, callbacks) → HTMLElement
  Gallery.js        – Filter bar, image grid, lightbox, record state management
  UploadPanel.js    – Upload form panel; owns a DropZone instance
```

## Architecture & Auth

- **Authentication**: Powered by Firebase Google Auth. The app listens for auth changes in `app.js` and renders the `#user-profile` card accordingly.
- **Security**: Access to Firestore and Storage is restricted to a specific administrator UID via rules.
- **Data Flow**: `js/api.js` routes all calls through either Firebase or local dummy shims. Dummy mode includes a persistent session state for the demo user.
- **Modals**: `Modal.open()` returns a Promise. The login modal is handled separately in `app.js` with a custom body and button wiring.
- **Responsive**: The `#user-profile` card and all main sections stack vertically on mobile (max-width 780px).

## Key Conventions

- **Auth Required**: All write operations require a valid user session.
- **Escaping**: All user-supplied strings inserted into `innerHTML` must go through `esc()` from `js/utils.js`.
- **Error Handling**: `js/api.js` uses `fb_error()` to translate Firebase error codes (like `permission-denied`) into user-friendly messages displayed in UI components.
- **Image Compression**: `compressImage(file)` resizes + re-encodes as JPEG (max 1920×1080, q=0.82) before upload.
- **Dates**: Stored as ISO strings (`YYYY-MM-DD`); formatted for display via `formatDate()`.
