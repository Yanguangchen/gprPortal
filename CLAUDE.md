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
index.html   – Single-page shell; all sections (upload, filter bar, gallery, modals)
style.css    – Animated gradient background, glassmorphism cards, responsive grid
app.js       – All logic: CRUD API routing, gallery render, filter, upload, modals
```

## Architecture

`app.js` has a single `USE_FIREBASE` flag that routes all data operations through either the live Firebase functions (`fb_*`) or local dummy shims (`dummy_*`) that mirror the same async API. The `api` object at the module level is the only entry point for data operations — all UI code calls `api.fetchAll()`, `api.create()`, `api.update()`, `api.delete()`.

State is kept in two module-level variables: `allRecords` (master list, always the full unfiltered set) and `selectedFile` (currently staged upload). `filterRecords()` derives the filtered view from `allRecords` on every render — there is no separate filtered-state variable.

Gallery cards are re-rendered from scratch on every `renderGallery()` call. Filter dropdowns are rebuilt from the current `allRecords` set via `rebuildFilterDropdowns()`.

## Key Conventions

- All user-supplied strings inserted into `innerHTML` must go through `esc()` (HTML-escapes `& < > " '`)
- Modals set `document.body.style.overflow = "hidden"` on open and restore it on close
- Upload, edit, and delete operations each have a dedicated `setUploading()` / `setEditSaving()` / `setDeleting()` helper that toggles button `disabled` state and swaps the text/spinner
- Dummy records use picsum.photos seeded URLs so layout is testable without real images
- Date values are stored and compared as ISO strings (`YYYY-MM-DD`); display formatting is done at render time with `toLocaleDateString`
