# PFX

PFX is a safe, installable, offline-first reference runtime for deterministic workflows. It is intentionally separate from PG1234 and Empire branding.

## What this repository provides
- A GitHub Pages-ready Progressive Web App
- Offline installation on supported browsers
- A deterministic JSON workflow runner
- Cartridge-style namespace isolation
- Hash-chained audit records
- No cloud dependency for the included demo

## Security boundary
PFX does not take over a device, bypass permissions, persist secretly, or install native machine code from a web page. Browser installation is user-consented and sandboxed.

## Run locally
```bash
npm run dev
```
Open http://localhost:8080.

## Deploy to GitHub Pages
1. Put these files in the PFX repository.
2. In GitHub, open Settings > Pages.
3. Select GitHub Actions as the source.
4. Push to `main`; the included workflow publishes `public/`.

## Install
- Android/desktop Chromium: open the deployed site and press **Install PFX**.
- iPhone/iPad Safari: Share > Add to Home Screen.
- Linux/Windows/macOS native packaging can be added later with signed platform-specific artifacts. Web pages cannot silently install native binaries.

## Determinism scope
The included runner is deterministic for the same canonical JSON input and supported operations. It is a reference implementation, not a trained AI model.
