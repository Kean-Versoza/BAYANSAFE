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
│       ├── App.jsx              # Routes (/ /privacy /terms /account /admin)
│       ├── pages/               # HomePage, Privacy, Terms, AccountPage, AdminPage
│       ├── sections/            # Home / About / Registration sections
│       ├── components/          # NavPill, SiteFooter, ContactForm, RfidField, ...
│       ├── layouts/             # LegalLayout (privacy + terms shell)
│       ├── hooks/               # useSiteConfig, usePageSnap, useAccount, useRfidReader
│       ├── config/site.js       # Fallback nav / footer / cookie text
│       ├── lib/skeleton.js      # The page skeleton loader
│       └── styles/              # style.css, account.css, admin.css
├── server/                      # Node.js backend (Express, used by dev + `npm start`)
│   ├── index.js                 # API + static hosting + SPA fallback
│   ├── siteConfig.js            # Nav / footer / cookie text (edit here)
│   ├── footerConfig.js          # Footer text for the older /api/footer endpoint
│   ├── db/                      # PostgreSQL pool + SQL migrations
│   ├── routes/                  # register, account, admin, contact, mail
│   ├── services/                # users, sessions, admin auth, mailer, cookies
│   └── scripts/                 # setupDb, checkDb, checkMail
├── shared/rfid.js               # Card-number rules (used by client and server)
├── docker-compose.yml           # A PostgreSQL server for local development
├── vercel.json                  # Vercel build + routing configuration
└── package.json                 # Root scripts and backend dependencies
```

## Features

- **Home page** — Home / About / Registration in one scrolling page, with the
  skeleton loader and the section-following nav pill.
- **Account page** (`/account`) — sign in, change the name, the email and the
  password, link an RFID card, download your data, or remove the account.
- **RFID** — the registration form and the account page both accept a card,
  from a USB reader that types, a serial reader, or by hand.
- **Admin dashboard** (`/admin`) — the account list, the growth chart, the
  email log and the health of the database and the mail provider.
- **Email** — a welcome message after someone registers, sent through Gmail,
  Brevo, Resend or any SMTP server.
- **Contact form** — the footer's "Help Center" jumps to a form that mails the
  team. Messages are answered by replying to them.

The site still renders, and the home page still works, when PostgreSQL is not
running. Only the features above need it.

## Requirements

- Node.js 18 or newer (tested on Node 24)
- npm
- PostgreSQL 16 (only for accounts, the admin page and the contact form) —
  `docker compose up -d` starts one

## Configuration

```bash
cp .env.example .env       # then fill in the database and the email settings
npm run db:setup           # creates the tables (needs PostgreSQL running)
npm run db:check           # is the database reachable?
npm run mail:check         # do the email settings work?
```

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
