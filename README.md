# BAYANSAFE

A Philippine Smart Community Disaster Intelligence and Preparedness Response Game.

The site is built with **React** (the front end) and **Node.js / Express** (the back end).

---

## What you need

| Tool   | Version |
| ------ | ------- |
| Node.js | 20.19 or newer (22 and 24 work too) |
| npm    | 10 or newer         |

Check with `node --version` and `npm --version`.

## Getting started

```bash
npm install     # once, installs the client and the server
npm run dev     # starts both
```

Then open **http://localhost:5173**.

| What            | Where                        |
| --------------- | ---------------------------- |
| The React site  | http://localhost:5173        |
| The API server  | http://localhost:3000        |

While developing, Vite sends every `/api/...` call to the Express server, so you
only ever open port 5173.

## Other commands

```bash
npm run build    # builds the React app into client/dist
npm start        # runs the Express server, which serves the built site on port 3000
npm run preview  # build + start, the way the site is really published
```

Use `npm start` (after `npm run build`) to see the site exactly as it will be
online: <http://localhost:3000>.

## Setting up the database

The site needs PostgreSQL for the accounts. It takes two commands:

```bash
docker compose up -d                              # start PostgreSQL
npm run db:setup --workspace server               # create the tables
```

Read the [database section](#the-database-postgresql) for the details.

---

## How the project is laid out

```
BAYANSAFE/
+-- shared/
�   +-- site.config.js     the text of the site: footer, cookie notice, navigation
+-- client/                the React app (Vite)
�   +-- public/images/     the pictures
�   +-- src/
�       +-- components/    the pieces of the page
�       +-- content/       the text of the legal pages
�       +-- hooks/         the loader, the active section, the site configuration
�       +-- lib/           the code that draws the skeleton loader
�       +-- pages/         Home, Privacy, Terms
�       +-- styles/        style.css
+-- server/                the Node.js app (Express)
�   +-- .env.example       the database and Gmail settings, copy it to .env
�   +-- src/
�       +-- db/            the connection to PostgreSQL and the migrations
�       +-- routes/        /api/register, /api/contact
�       +-- services/      accounts, the Gmail connection, the email templates
�       +-- index.js       the server itself
+-- docker-compose.yml     a PostgreSQL server in a container
```

## The database (PostgreSQL)

The accounts are kept in **PostgreSQL**. The `pg` package talks to it, and the
tables are created by a small migration system.

### 1. Start PostgreSQL

The easiest way is the file that comes with the project:

```bash
docker compose up -d
```

It starts a PostgreSQL 16 with the user `bayansafe`, the password `bayansafe`
and the database `bayansafe`, on port 5432.

If you already have PostgreSQL on your computer, skip this and use your own
settings in `server/.env` instead.

### 2. Fill in the connection

```bash
copy server\.env.example server\.env     (Windows)
```

```
DATABASE_URL=postgresql://bayansafe:bayansafe@localhost:5432/bayansafe
```

For a hosted database (Neon, Supabase, Railway) use their URL and add
`DATABASE_SSL=true`.

### 3. Create the tables

```bash
npm run db:setup --workspace server
```

This creates the database when it is missing and applies the migrations. It is
safe to run again: the migrations that were already applied are skipped.

```bash
npm run db:check --workspace server
```

says whether the database answers.

### Starting PostgreSQL by hand

If PostgreSQL runs as a Windows service, you never need this. If it does not:

```bash
npm run db:start --workspace server
```

It finds the installation in `C:\Program Files\PostgreSQL` and starts it.

To make it start with the computer, run this once in **PowerShell as
Administrator**:

```powershell
.\server\scripts\register-postgres-service.ps1
```

It registers the service `postgresql-x64-17` and starts it right away.

### The tables

| Table              | What is in it                                              |
| ------------------ | ---------------------------------------------------------- |
| `users`            | id, username, email, the hashed password, when it was made |
| `schema_migrations`| which migrations were already applied                      |

Names are not case sensitive: `Juan` and `juan` are the same player. The
database makes sure of that, so two people cannot use the same name.

### Adding a table

Put a new file in `server/src/db/migrations/`, named `002_...sql`, and run
`npm run db:setup` again. The file is applied once and remembered.

### The files

| File                                | What it holds                       |
| ----------------------------------- | ----------------------------------- |
| `server/src/db/pool.js`             | the connection pool and the health check |
| `server/src/db/migrate.js`          | runs the migrations, once each      |
| `server/src/db/migrations/*.sql`    | the tables                          |
| `server/src/services/users.js`      | reads and writes the accounts       |
| `server/src/scripts/setupDb.js`     | the `npm run db:setup` command      |

## The pages

| Address        | What it shows                                                      |
| -------------- | ------------------------------------------------------------------ |
| `/`            | the one page with Home, About and Register                          |
| `/about`       | jumps to the About part of that page                                |
| `/registration`| jumps to the Register part of that page                             |
| `/privacy`     | the Privacy Policy                                                  |
| `/terms`       | the Terms of Service                                                |

The old `/about` and `/registration` addresses still work, they just jump to
the right part of the page.

## The API

| Call                 | What it does                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `GET /api/health`    | checks that the server and the database are alive                    |
| `GET /api/config`    | the site configuration (footer, cookie notice, navigation)           |
| `POST /api/register` | creates an account and emails a welcome message                      |
| `GET /api/mail/status` | tells you whether Gmail is set up and reachable                   |
| `POST /api/mail/test` | sends a test email to the site's own inbox                         |
| `POST /api/contact`  | sends a message from the contact form to your Gmail                  |

The registration form sends this to `POST /api/register`:

```json
{ "username": "player1", "email": "player1@example.com", "password": "a-good-password", "acceptedTerms": true }
```

The server checks everything and answers with `{ "ok": true, "message": "..." }`
or with `{ "ok": false, "error": "..." }` and a status code (400 for a bad
request, 409 for an account that already exists).

A successful registration also says whether the welcome email went out:

```json
{ "ok": true, "message": "Welcome, player1! Your account is ready.",
  "emailSent": true, "emailNote": "", "user": { ... } }
```

The player sees *"We sent a welcome email to your address."* when it worked.

Passwords are never stored as plain text. They are hashed with **scrypt** and a
random salt before they go into the `users` table.

## Sending email

The site uses **Nodemailer** to send email. Two things use it:

- the **contact form** in the footer &rarr; the message arrives in your inbox
- the **welcome email** after somebody creates an account

### Pick a provider

Set `MAIL_PROVIDER` in `server/.env`:

| `MAIL_PROVIDER` | Needs                                | App password? |
| --------------- | ------------------------------------ | ------------- |
| `gmail`         | `GMAIL_USER`, `GMAIL_APP_PASSWORD`   | yes           |
| `brevo`         | `BREVO_USER`, `BREVO_PASSWORD`       | no            |
| `resend`        | `RESEND_API_KEY`                     | no            |
| `custom`        | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASSWORD` | no        |

#### Gmail

Gmail does not accept the normal account password for sending mail, it needs an
**app password**:

1. Turn on 2-Step Verification on the Google account
2. Open <https://myaccount.google.com/apppasswords>
3. Choose "Mail" and give it a name
4. Google shows a 16 character code &mdash; copy it

```
MAIL_PROVIDER=gmail
GMAIL_USER=yourteam@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```

> **"The settings you are looking for is not available for your account"**
>
> That page stays empty when the account is managed by a school or organisation
> (an admin can switch app passwords off), when you are signed in with a
> non-Google account, or when 2-Step Verification is not on yet. Turn on
> 2-Step Verification first &mdash; that alone fixes it for most accounts.
> If it is a managed account, use **brevo** below: it needs no Google setup
> at all.

#### Brevo (no app password, free for 300 emails a day)

1. Make a free account at <https://www.brevo.com>
2. Open **Settings &rarr; SMTP & API**
3. Copy the **login** and generate an **SMTP key**

```
MAIL_PROVIDER=brevo
BREVO_USER=yourteam@yourteam.com
BREVO_PASSWORD=xsmtpsib-xxxxxxxxxxxxxxxxxxxx
```

#### Resend (no app password)

1. Make a free account at <https://resend.com>
2. Make an API key
3. A new account can only send to your own address until you add a domain

```
MAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_USER=yourteam@gmail.com
```

### Check that it works

```bash
npm run mail:check --workspace server
```

It says `Connected to ...` when the details are right, and tells you what to fix
when they are not.

You can also send yourself a test email:

```bash
curl -X POST http://localhost:3000/api/mail/test
```

It answers with *"A test email was sent to yourteam@gmail.com. Check your inbox."*

### What the player sees

After somebody creates an account, the site sends them a **welcome email** and
tells them about it:

> Welcome, player1! Your account is ready. **We sent a welcome email to your
> address.**

If the email is not set up, the account is still made and the player is told
the email could not be sent.

### Without the .env file

The site still works. The contact form says that email is not set up yet, and
the account is still created &mdash; only the welcome email is skipped.

### The files

| File                                  | What it holds                              |
| ------------------------------------- | ------------------------------------------ |
| `server/src/services/mailer.js`       | the Nodemailer connection and the providers |
| `server/src/services/mailTemplates.js`| the text and HTML of the emails             |
| `server/src/routes/mail.js`           | `GET /api/mail/status` and the test email  |
| `server/src/routes/contact.js`        | `POST /api/contact`                         |
| `server/src/scripts/checkMail.js`     | the `npm run mail:check` command            |

## The admin dashboard

Open **http://localhost:5173/admin** (or `/admin` on the built site).

Sign in with the password in `server/.env`:

```
ADMIN_PASSWORD=bayansafe-admin
```

**Change that to something only you know.** Anyone with the password can see
every account and remove accounts, so do not use the example value for a real
project.

The dashboard shows:

- **the numbers** &mdash; how many accounts there are, how many joined today and
  this week, and how many emails went out (and how many failed)
- **a chart** of the new accounts over the last 14 days
- **the system** &mdash; whether the database and the email are working, with
  the PostgreSQL version
- **the accounts** &mdash; with a search box, and a button to remove one
- **the email log** &mdash; every email the site sent, and whether it worked

### How the sign in works

The password is checked on the server. When it is right, the server gives out a
cookie that is signed with `SESSION_SECRET` and is good for 8 hours. The
cookie is `httpOnly`, so scripts cannot read it, and it is sent with
`SameSite=Lax`.

After 5 wrong tries the sign in is blocked for 10 minutes.

The admin pages are not linked from the site, so nobody finds them by accident.
Anyone can still reach `/admin` &mdash; but they cannot get past the password.

### The admin API

| Call                       | What it does                          |
| -------------------------- | ------------------------------------- |
| `GET /api/admin/session`   | are you signed in?                    |
| `POST /api/admin/login`    | sign in with the password             |
| `POST /api/admin/logout`   | sign out                              |
| `GET /api/admin/stats`     | the numbers and the chart             |
| `GET /api/admin/users`     | the accounts, `?q=` searches          |
| `GET /api/admin/emails`    | the email log                         |
| `GET /api/admin/status`    | how the database and the email do     |
| `DELETE /api/admin/users/:id` | remove one account                 |

### The files

| File                                | What it holds                          |
| ----------------------------------- | -------------------------------------- |
| `client/src/pages/AdminPage.jsx`    | the dashboard page                     |
| `client/src/styles/admin.css`       | how the dashboard looks                |
| `server/src/routes/admin.js`        | the admin API                          |
| `server/src/services/adminAuth.js`  | the password and the signed cookie     |
| `server/src/db/migrations/002_create_email_log.sql` | the email log table    |

## Changing the text of the site

Everything people read is in **`shared/site.config.js`**: the brand name, the
navigation, the footer, the contact address and the cookie notice. Edit that
one file and both the client and the server use the new text.

## The loader

The grey blocks that appear while the page loads are drawn by measuring the
real layout of the page, so they always line up with the content they stand in
for. The code lives in `client/src/lib/skeleton.js`, the timing is in
`client/src/hooks/useSkeleton.js` (`LOADER_SETTINGS`).

---

# SBIT-3H project
