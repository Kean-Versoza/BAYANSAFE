# BAYANSAFE

**SBIT-3H project**

A Philippine Smart Community Disaster Intelligence and Preparedness Response Game.

Built with **React** (Vite) on the frontend and **Node.js + Express** on the backend.

---

## Project structure

```
BAYANSAFE/
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
├── server/                      # Node.js backend (Express)
│   ├── index.js                 # API + static hosting + SPA fallback
│   ├── footerConfig.js          # Footer / cookie text (edit here)
│   └── store.js                 # In-memory account store (scrypt hashes)
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
