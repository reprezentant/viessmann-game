# Changelog

## 2025-08-24 — v0.4.0

Map UX
- Zoom and pan on the isometric map (wheel zoom, Alt + drag, +/- buttons, center-on-home).
- Expanded zoom range and responsive viewport; hover card adapts under transforms.
- Minimap anchored to the bottom-right of the "Dom i otoczenie" section, showing entities and current viewport; click-to-center.

Placement & Rules
- Forests only on the perimeter ring; non-forest items are blocked on the edge.
- Owned counter fixed: increments only on placement; no double-counting.
- Payment flow moved to placement. Pressing Esc after Buy no longer deducts resources; placement log now includes cost.
- Home upgrade placement rules preserved (only on the home tile).

UI polish
- Badges and hints for forest placement; improved shop card states.
- Weather animations contained to the map area.
- Minor spacing/typography tweaks and header economy summary.

Code cleanup
- Removed legacy prototypes and unused components from `src/`.
- Kept a single entry (`index.html` → `src/main.tsx` → `src/App.tsx` → `src/ViessmannGame.tsx`).
- Tagged release: v0.4.0.

Build
- Verified successful production build via Vite.
