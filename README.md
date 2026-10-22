# BAYANSAFE

**SBIT-3H project**

A Philippine Smart Community Disaster Intelligence and Preparedness Response Game.

Built with **React** (Vite) on the frontend and **Node.js** on the backend
(Express locally, Vercel functions in production).

---

## Project structure

```
BAYANSAFE/
├── api/                         # Vercel functions
│   ├── index.js                 #   /api
│   └── [...path].js             #   every other /api/* path
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
│   ├── app.js                   # The Express app, shared by the server and Vercel
│   ├── vercelHandler.js         # The Vercel function entry point
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
- PostgreSQL 18 (only for accounts, the admin page and the contact form) -
  `docker compose up -d` starts one, or install it on Windows with
  `winget install PostgreSQL.PostgreSQL.18`. The live site runs 18.6 too, so a
  table or a backup moves between the two without a version step.

## Configuration

```bash
cp .env.example .env       # then fill in the database and the email settings
npm run db:setup           # creates the tables (needs PostgreSQL running)
npm run db:check           # is the database reachable?
npm run mail:check         # do the email settings work?
```

The database connection, the admin sign-in and the email settings all come from
the environment, so the same `.env` works locally and on a deployed site.

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

The repository is already connected to the Vercel project **bayansafe**
(team **BAYANSAFE**), so a push to `main` builds and deploys on its own. The
live site is **https://bayansafe.vercel.app**.

If the project ever has to be created again:

1. Push the repository to GitHub.
2. On vercel.com choose **Add New → Project** and import the repository.
3. Leave **Root Directory** at the repository root and press **Deploy**.

`vercel.json` takes care of the rest:

- **Build command:** `npm run build` (the root script installs the client and builds it into `client/dist`).
- **Output directory:** `client/dist`.
- **Frontend:** every non-API path is rewritten to `index.html`, so client-side routes such as `/privacy` work on a hard refresh or a shared link.
- **API:** `api/[...path].js` catches every `/api/*` path and runs the same Express routes the local server runs. Unknown `/api/*` paths get a JSON 404 rather than the SPA shell.

Vercel gives the filesystem precedence over rewrites, so the `api/` functions
always win over the catch-all rewrite to `index.html`.

### The environment variables of a deployed site

There is no `.env` file on Vercel — the same variables are filled in under
**Project → Settings → Environment Variables**, and they have to be added for
**Production**, **Preview** and **Development**:

| Variable        | What it is                                             | Needed |
| --------------- | ------------------------------------------------------ | ------ |
| `DATABASE_URL`  | The PostgreSQL connection string (set by the Neon integration) | yes |
| `DATABASE_SSL`  | `true` for most hosted databases                        | yes    |
| `PGPOOL_MAX`    | `1` or `2`, so a function does not open too many connections | yes |
| `ADMIN_EMAIL`   | The email the admin signs in with                       | yes    |
| `ADMIN_PASSWORD`| The password for `/admin`                               | yes    |
| `SESSION_SECRET`| A long random text that signs the admin cookie          | yes    |
| `MAIL_*`        | The email settings, if the site should send mail        | no     |

A long `SESSION_SECRET` can be made with `openssl rand -hex 32`.

### The database of a deployed site

The live site runs on **Neon Postgres**, attached through the Vercel
Marketplace, so the database lives next to the project instead of in a
separate account to look after:

- Project → **Storage** shows the resource `bayansafe-db`.
- Attaching it wrote `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` and the
  `PG*` / `POSTGRES_*` aliases into the project environment variables for all
  three environments. There is nothing to paste in by hand.
- The database itself is called **bayansafe**, the same name it has on this
  computer, so the two can be read side by side without translating names.
- The database is in **Singapore** (`sin1`), the closest region to the
  Philippines, and it sits on Neon's free plan.

The tables are created by the migrations in `server/db/migrations`. They are
not applied automatically on deploy, so run them from your machine against the
same database the site uses:

```bash
# The Vercel CLI writes the project variables into .env.local
vercel env pull .env.local
# ...or copy DATABASE_URL by hand into .env

npm run db:setup     # creates the tables
npm run db:check     # is the database reachable?
```

`db:setup` reads `DATABASE_URL` and leaves it alone when one is already in the
shell, so it can be pointed at the hosted database without editing a file:

```bash
$env:DATABASE_URL = "postgresql://..."   # PowerShell
$env:DATABASE_SSL = "true"
npm run db:setup
```

Without the tables, registration and the admin dashboard answer "The database
could not be reached."

### Copying the players from this computer to the live site

`db:setup` creates empty tables. To move the accounts, the sign ins and the
email log from the database on this computer to the deployed one, use:

```bash
# The database on this computer comes from .env (DATABASE_URL).
# The target is the database of the deployed site.
$env:TARGET_DATABASE_URL = "postgresql://..."   # PowerShell
npm run db:push
```

`db:push` empties the target tables and writes the local rows, so running it
twice is safe and the result is always an exact copy. It does not touch the
schema — run `db:setup` against the target first.

The copy is done with ordinary SQL rows rather than `pg_dump`, so the two
databases do not have to be the same PostgreSQL version. A local 16 can fill a
hosted 18 (which is what the live site runs), and the other way round. Only
the `users`, `user_sessions` and `email_log` tables are copied;
`schema_migrations` is left alone, since each side keeps its own record of the
migrations it has applied.

To copy the other way, point `SOURCE_DATABASE_URL` at the hosted database and
leave `DATABASE_URL` as the target.

A new environment variable only reaches a deployment that is created after it
was added, so redeploy (`git commit --allow-empty -m redeploy` or the
**Redeploy** button) after changing one.

### What is shared with the local server

Express (`server/`, used by `npm run dev` and `npm start`) and the Vercel
function run the same routes, so there is nothing to keep in sync by hand:

| Endpoint             | Express                | Vercel function  | Shared module            |
| -------------------- | ---------------------- | ---------------- | ------------------------ |
| `/api/health`        | `server/app.js`        | `api/[...path].js` | `server/app.js`        |
| `/api/footer`        | `server/app.js`        | `api/[...path].js` | `server/footerConfig.js` |
| `/api/register`      | `server/routes/register.js` | `api/[...path].js` | `server/services/users.js` |
| `/api/account/*`     | `server/routes/account.js` | `api/[...path].js` | `server/services/users.js` |
| `/api/admin/*`       | `server/routes/admin.js`   | `api/[...path].js` | `server/services/adminAuth.js` |

A new endpoint is added in `server/app.js` (or in a file in `server/routes/`)
and it works on both, at the same time.

## API

| Method | Endpoint                 | Description                                       |
| ------ | ------------------------ | ------------------------------------------------- |
| GET    | `/api/health`            | Health/uptime check                               |
| GET    | `/api/footer`            | Footer, badge, link and cookie-bar content        |
| GET    | `/api/config`            | Navigation, footer and cookie text                |
| POST   | `/api/register`          | Create an account (username, email, password, terms) |
| GET    | `/api/register/rfid/:uid`| Look up an account by its card                    |
| GET    | `/api/account/session`   | Is somebody signed in?                            |
| POST   | `/api/account/login`     | Sign in with email and password                   |
| POST   | `/api/account/logout`    | Sign out                                          |
| GET    | `/api/account`           | The account of the signed in player               |
| PATCH  | `/api/account`           | Change the name or the email                      |
| POST   | `/api/account/password`  | Change the password                               |
| POST   | `/api/account/card`      | Link an RFID card                                 |
| DELETE | `/api/account`           | Remove the account                                |
| POST   | `/api/contact`           | The message form in the footer                    |
| GET    | `/api/mail/status`       | Is email set up?                                  |
| POST   | `/api/mail/test`         | Send a test email                                 |
| POST   | `/api/admin/login`       | Sign in to the dashboard                          |
| POST   | `/api/admin/logout`      | Sign out of the dashboard                         |
| GET    | `/api/admin/session`     | Is the admin signed in?                           |
| GET    | `/api/admin/stats`       | The numbers and the chart                         |
| GET    | `/api/admin/users`       | The account list (`?q=`, `?limit=`, `?offset=`)    |
| GET    | `/api/admin/emails`      | The emails the site sent                          |
| GET    | `/api/admin/status`      | The health of the database and the mail provider  |
| PATCH  | `/api/admin/users/:id/card` | Link or unlink a card                          |
| DELETE | `/api/admin/users/:id`   | Remove an account                                 |

`POST /api/register` expects JSON:

```json
{ "username": "juan", "email": "juan@example.com", "password": "secret123", "terms": true }
```

Accounts live in PostgreSQL, and passwords are salted and hashed with scrypt —
never stored as plain text.

## Routes

| URL               | Page                                             |
| ----------------- | ------------------------------------------------ |
| `/`               | Home, About and Registration (one scrolling page)|
| `/privacy`        | Privacy Policy                                   |
| `/terms`          | Terms of Service                                 |
| `/about`          | Redirects to `/#about`                           |
| `/registration`   | Redirects to `/#registration`                    |
| `/account`        | The player's account page                        |
| `/admin`          | Admin sign in                                    |
| `/admin/dashboard`| The admin dashboard                              |
| `/help`           | The help center                                  |

## Editing content

- **Footer / cookie bar:** `server/footerConfig.js` (served through `/api/footer`)
- **About, Home and Registration text:** `client/src/sections/`
- **Privacy and Terms:** `client/src/pages/`
- **Colors, layout and responsive rules:** `client/src/styles/style.css`
