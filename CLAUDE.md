# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GPR Image Portal — a CRUD web application for a construction engineering company to manage Ground Penetrating Radar (GPR) scan images. Single-page app with no build step.

## Tech Stack

- **Frontend**: Pure HTML5, plain CSS3, Vanilla JavaScript (ES modules, no bundler)
- **Database**: Firebase Firestore (NoSQL, collection: `gpr_images`)
- **File Storage**: Firebase Storage (`gpr_images/` path prefix)
- **No frameworks, no npm, no build step** — open `index.html` directly in a browser or serve with any static file server

## Running Locally

```bash
# Any static file server works. Examples:
python3 -m http.server 8080
npx serve .
```

Open `http://localhost:8080` in a browser. The app runs on **dummy data** by default (no Firebase needed).

## Firebase Setup

To connect to a live Firebase project:

1. Replace placeholder values in `app.js` → `firebaseConfig` object
2. Set `USE_FIREBASE = true` at the top of `app.js`
3. Firebase SDKs are loaded at runtime via CDN (v10.12.2) — no install required

## Firestore Schema (`gpr_images` collection)

| Field         | Type      | Notes                              |
|---------------|-----------|------------------------------------|
| `companyName` | string    |                                    |
| `projectName` | string    |                                    |
| `imageDate`   | string    | ISO date `YYYY-MM-DD`              |
| `imageUrl`    | string    | Firebase Storage download URL      |
| `imageName`   | string    | Original filename                  |
| `storagePath` | string    | Storage path for deletion          |
| `createdAt`   | timestamp | `serverTimestamp()` on create      |

## File Structure

```
index.html          – Minimal shell: header + two mount points (#upload-mount, #gallery-mount)
style.css           – Animated gradient background, glassmorphism cards, responsive grid
app.js              – Orchestrator only: instantiates modules, wires api → components (~70 lines)
manifest.json       – PWA manifest (standalone fullscreen, theme #060a12)
js/
  api.js            – Data layer: USE_FIREBASE flag, Firebase CRUD (fb_*), dummy shims (dummy_*)
  utils.js          – esc(), formatDate(), delay()
  Modal.js          – Generic promise-based modal class (form or confirm variants)
  DropZone.js       – Self-contained drag-drop / click-to-browse file picker
  ImageCard.js      – Pure function: buildCard(rec, callbacks) → HTMLElement
  Gallery.js        – Filter bar, image grid, lightbox, record state management
  UploadPanel.js    – Upload form panel; owns a DropZone instance internally
```

## Architecture

`js/api.js` has a single `USE_FIREBASE` flag that routes all data operations through either the live Firebase functions (`fb_*`) or local dummy shims (`dummy_*`). The `api` object is the only export callers use — `api.fetchAll()`, `api.create()`, `api.update()`, `api.delete()`.

All UI components are ES module classes/functions. `app.js` instantiates them, passes callbacks, and calls `gallery.setRecords()` after the initial fetch. Components never import `api` directly — data flows in through callbacks and out through methods like `gallery.addRecord()` / `gallery.updateRecord()` / `gallery.removeRecord()`.

`Modal.open()` returns a Promise that resolves with field values on confirm or `null` on cancel. The modal stays open after confirm; the caller calls `modal.setLoading(true)`, awaits the async work, then calls `modal.close()` on success or `modal.setStatus()` on error.

`Gallery._filter()` reads directly from filter DOM inputs on every `_render()` call — no duplicated filter-state object.

## Key Conventions

- All user-supplied strings inserted into `innerHTML` must go through `esc()` from `js/utils.js`
- `[hidden] { display: none !important; }` is in `style.css` so the HTML `hidden` attribute works correctly on `display:flex` elements (modals, lightbox)
- Modals and lightbox set `document.body.style.overflow = "hidden"` on open and restore on close
- Each async operation (`setLoading`) disables its confirm button and swaps text↔spinner
- Dummy records use picsum.photos seeded URLs so layout is testable without Firebase
- Date values are stored and compared as ISO strings (`YYYY-MM-DD`); display formatting is done at render time via `formatDate()` in `js/utils.js`
- PWA icons (`favicon.png`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) must be supplied — `manifest.json` references them but they are not committed
