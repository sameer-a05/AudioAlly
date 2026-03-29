# Audio Ally frontend (React + Vite)

This document is for anyone who clones the repo to work on **UI only**. The web app lives in this directory (the same folder as `package.json` and `vite.config.js`), not in the Python `app/` package.

---

## Prerequisites

1. **Node.js** (LTS recommended: **20.x or 22.x**).  
   - Check: `node -v` and `npm -v`  
   - Install: [https://nodejs.org](https://nodejs.org) (includes `npm`)

2. **Git** (to clone and push your branch).

You do **not** need Python, `pip`, or `uvicorn` to run the dev server or build static assets. You only need the backend if you want live PDF/story APIs (see [Backend integration](#backend-integration-optional)).

---

## First-time setup

From this directory (`files/` in the repo, or wherever `package.json` is):

```bash
npm install
```

This installs everything listed in `package.json`, including:

| Area | Packages (high level) |
|------|------------------------|
| UI framework | `react`, `react-dom` |
| Routing | `react-router-dom` |
| Build tool | `vite`, `@vitejs/plugin-react` |
| Styling | `tailwindcss`, `@tailwindcss/vite` |
| Class names | `clsx`, `tailwind-merge` (see `src/lib/utils.js` `cn()`) |
| Icons | `lucide-react` (e.g. Sparkles, ArrowRight, Menu) |
| 3D hero background | `@splinetool/react-spline` (galaxy scene in shell) |
| Charts | `recharts` (if used on progress/stats pages) |
| HTTP | `axios` |

Dev-only: `eslint`, TypeScript types for React.

---

## Environment variables

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` only if you need API features locally:
   - **`VITE_ELEVENLABS_API_KEY`**: voice previews and ElevenLabs TTS in the learn flow.
   - **`GEMINI_API_KEY`** or **`VITE_GEMINI_API_KEY`**: Gemini-backed PDF story generation and answer evaluation.  
   - Vite also reads **`VITE_GEMINI_MODEL`** (default `gemini-2.0-flash`); see `vite.config.js` for how `GEMINI_API_KEY` and `VITE_GEMINI_API_KEY` are merged.

**UI-only workflow:** You can leave Gemini keys empty, run `npm run dev`, and still use navigation, Features, Voices (without previews if no ElevenLabs key), and static screens. Story generation from PDF requires a working Gemini key and usually the Python API for some flows.

Restart `npm run dev` after changing `.env`.

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Vite dev server (default `http://localhost:5173`). Hot reload. |
| `npm run build` | Production build to `dist/`. |
| `npm run preview` | Serve `dist/` locally to test the production build. |
| `npm run lint` | ESLint. |

---

## Project layout (UI)

```
src/
├── main.jsx                 # Entry; imports index.css, animations.css, globals.css
├── App.jsx                  # Routes, auth gate, GalaxyAppShell
├── index.css                # Tailwind + glass utilities (.glass, .card-border, animations)
├── components/
│   ├── layout/
│   │   └── GalaxyAppShell.jsx    # Full-app Spline background + shared navbar
│   └── ui/
│       ├── galaxy-interactive-hero-section.jsx  # Spline scene, GalaxyNavbar, hero copy
│       ├── feature-card.jsx                     # Glass feature cards + canvas wave
│       └── card.jsx                           # Login/register card primitives
├── pages/                   # Home, Features, Voices, Learn (PDF flow), Progress, Results, …
├── styles/
│   ├── globals.css          # Design tokens, .aa-* components
│   └── animations.css
└── services/                # AudioEngine, Gemini* clients, etc.
```

Notable UI patterns:

- **Galaxy background + one header:** `GalaxyAppShell` wraps routes; `GalaxyNavbar` matches Home/Features/Voices links.
- **Glass cards:** Tailwind utilities in `index.css` (`.glass`, `.card-border`, `.gradient-border`, `.inner-glow`) plus `.aa-card` in `globals.css`.
- **Feature cards:** `components/ui/feature-card.jsx` (wave canvas, tags, CTA with optional Sparkles icon).

---

## Backend integration (optional)

The Vite dev server proxies:

- **`/api`** → `http://localhost:8000` (FastAPI, if you run it)
- **`/node-api`** → `http://localhost:3000` (Express helper, if used)
- **`/gemini-api`** → Google Generative Language API (avoids CORS in dev)
- **`/elevenlabs-api`** → ElevenLabs API

So for full-stack work you run the Python server on port 8000 (or adjust `vite.config.js`) **and** `npm run dev` for the frontend.

---

## Pushing “frontend only” to Git

Your team may keep Python and Node in one repo. To **avoid** committing broken local Gemini config or backend experiments:

1. **Never commit `.env`** (it is gitignored). Commit **`.env.example`** only.
2. Commit changes under `src/`, `index.html`, `vite.config.js`, `package.json`, `package-lock.json`, `FRONTEND.md`, and shared assets.
3. If you use a **single branch** for UI work, push that branch; reviewers can ignore `app/` if your PR only touches frontend paths.
4. Optional: use a **branch or PR title** like `feat/ui: galaxy shell + feature cards` so reviewers know scope.

If the repo is split later, the “frontend” artifact is everything needed to run `npm ci && npm run build` from this folder.

---

## Troubleshooting

- **`npm install` fails:** Use a supported Node LTS; delete `node_modules` and `package-lock.json` only if your lead asks you to refresh the lockfile.
- **Blank page / wrong base URL:** Open the URL Vite prints (usually port 5173).
- **Gemini errors in dev:** Confirm `.env` matches a key that works for your team; see comments in `vite.config.js` about `GEMINI_API_KEY` vs `VITE_GEMINI_API_KEY`.
- **Spline / galaxy slow or errors:** The scene loads from Spline CDN; check network ad blockers.

---

## Related

- Python story API and `test_engine.py`: see `README.md` in this folder (StoryPath / FastAPI).
