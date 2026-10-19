# BAYANSAFE

**SBIT-3H project**

A Philippine Smart Community Disaster Intelligence and Preparedness Response Game.

Built with **React** (Vite) on the frontend and **Node.js** on the backend
(Express locally, Vercel functions in production).

---

## Project structure

```
BAYANSAFE/
├── api/                         # Vercel functions (one per endpoint, used when deployed)
│   ├── footer.js                #   GET  /api/footer
│   ├── health.js                #   GET  /api/health
│   ├── register.js              #   POST /api/register
│   └── not-found.js             #   JSON 404 for unknown /api/* paths
├── client/                      # React frontend (Vite)
│   ├── index.html
│   ├── vite.config.js
│   ├── public/images/           # Logo, banner, disaster icons, backgrounds
│   └── src/
│       ├── main.jsx             # React entry point
│       ├── App.jsx              # Routes (/ /privacy /terms + old redirects)
│       ├── pages/               # HomePage, Privacy, Terms
│       ├── sections/            # Home / About / Registration sections
│       ├── components/          # NavPill, SiteFooter, CookieBanner
│       ├── layouts/             # LegalLayout (privacy + terms shell)
│       ├── hooks/useFooter.js   # Loads footer text from the API
│       ├── config/footer.js     # Fallback footer text
│       ├── lib/skeleton.js      # The page skeleton loader
│       └── styles/style.css     # All site styling
├── server/                      # Node.js backend (Express, used by dev + `npm start`)
│   ├── index.js                 # API + static hosting + SPA fallback
│   ├── footerConfig.js          # Footer / cookie text (edit here)
│   ├── register.js              # Registration rules (shared with api/register.js)
│   └── store.js                 # In-memory account store (scrypt hashes)
├── vercel.json                  # Vercel build + routing configuration
└── package.json                 # Root scripts and backend dependencies
```

## Requirements

- Node.js 18 or newer (tested on Node 24)
- npm

## Development

```bash
npm install          # installs the backend and the client
npm run dev          # starts the API and the React dev server together
```

- Site: **http://localhost:5173** (Vite, with hot reload)
- API: **http://localhost:3001**

Vite proxies `/api/*` requests to the Node server, so there is nothing else to
configure.

## Production

```bash
npm run build        # builds the React app into client/dist
npm start            # serves the built site + API on http://localhost:3001
```

Set `PORT` to change the server port.

## Deploying to Vercel

The repository is already configured for Vercel — import it and deploy, there
are no build settings to fill in.

1. Push the repository to GitHub.
2. On vercel.com choose **Add New → Project** and import the repository.
3. Leave **Root Directory** at the repository root and press **Deploy**.

`vercel.json` takes care of the rest:

- **Build command:** `npm run build` (the root script installs the client and builds it into `client/dist`).
- **Output directory:** `client/dist`.
- **Frontend:** every non-API path is rewritten to `index.html`, so client-side routes such as `/privacy` work on a hard refresh or a shared link.
- **API:** each file in `api/` becomes a function — `/api/health`, `/api/footer`, `/api/register`. Unknown `/api/*` paths get a JSON 404 rather than the SPA shell.

Vercel gives the filesystem precedence over rewrites, so the `api/` functions
always win over the catch-all rewrite to `index.html`.

### What is shared with the local server

Express (`server/`, used by `npm run dev` and `npm start`) and the Vercel
functions share their logic, so there is nothing to keep in sync by hand:

| Endpoint            | Express                     | Vercel function    | Shared module                                   |
| ------------------- | --------------------------- | ------------------ | ----------------------------------------------- |
| `GET /api/health`   | `server/index.js`           | `api/health.js`    | –                                               |
| `GET /api/footer`   | `server/index.js`           | `api/footer.js`    | `server/footerConfig.js`                        |
| `POST /api/register`| `server/index.js`           | `api/register.js`  | `server/register.js` + `server/store.js`        |

Editing `server/footerConfig.js` or `server/register.js` updates both backends.

### Before relying on registration in production

Accounts live in memory (`server/store.js`). That is fine locally, but on Vercel
each function instance has its own memory and is recycled at any time, so a
registration can silently disappear and the duplicate-email check becomes
unreliable. The form still submits and shows its success message; nothing is
kept. To persist accounts, replace `server/store.js` with a database (Vercel
Postgres, Neon, Supabase, ...) — the rest of the code only calls `createUser`,
`findAccount` and `verifyUser`.

## API

| Method | Endpoint       | Description                                      |
| ------ | -------------- | ------------------------------------------------ |
| GET    | `/api/health`  | Health/uptime check                              |
| GET    | `/api/footer`  | Footer, badge, link and cookie-bar content       |
| POST   | `/api/register`| Create an account (username, email, password, terms) |

`POST /api/register` expects JSON:

```json
{ "username": "juan", "email": "juan@example.com", "password": "secret123", "terms": true }
```

Accounts are kept **in memory** for now (they disappear when the server
restarts) and passwords are salted and hashed with scrypt — never stored as
plain text.

## Routes

| URL             | Page                                             |
| --------------- | ------------------------------------------------ |
| `/`             | Home, About and Registration (one scrolling page)|
| `/privacy`      | Privacy Policy                                   |
| `/terms`        | Terms of Service                                 |
| `/about`        | Redirects to `/#about`                           |
| `/registration` | Redirects to `/#registration`                    |

## Editing content

- **Footer / cookie bar:** `server/footerConfig.js` (served through `/api/footer`)
- **About, Home and Registration text:** `client/src/sections/`
- **Privacy and Terms:** `client/src/pages/`
- **Colors, layout and responsive rules:** `client/src/styles/style.css`
