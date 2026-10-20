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

> The project is in the `BAYANSAFE` folder. The folder above it has a small
> `package.json` that passes the commands on, so `npm run dev` works from
> either place.

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
�   +-- rfid.js            the rules of a card number, used by the client and the server
+-- client/                the React app (Vite)
�   +-- public/images/     the pictures
�   +-- src/
�       +-- components/    the pieces of the page
�       +-- content/       the text of the legal pages
�       +-- hooks/         the loader, the active section, the site configuration, the reader, the account
�       +-- lib/           the code that draws the skeleton loader
�       +-- pages/         Home, Privacy, Terms, Account, Admin
�       +-- styles/        style.css, account.css, admin.css
+-- server/                the Node.js app (Express)
�   +-- .env.example       the database and Gmail settings, copy it to .env
�   +-- src/
�       +-- db/            the connection to PostgreSQL and the migrations
�       +-- routes/        /api/register, /api/contact, /api/account
�       +-- services/      accounts, the sign ins, the Gmail connection, the email templates
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
| `users`            | id, username, email, the hashed password, the card, when it was made |
| `user_sessions`    | the sign ins of the players                                |
| `email_log`        | every email the site sent                                  |
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
| `/account`     | the account of the player: sign in, name, card, password, removal  |
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
| `GET /api/register/rfid/:uid` | says whether a card is already in use                    |
| `GET /api/mail/status` | tells you whether Gmail is set up and reachable                   |
| `POST /api/mail/test` | sends a test email to the site's own inbox                         |
| `POST /api/contact`  | sends a message from the contact form to your Gmail                  |
| `GET /api/account/session` | says whether a player is signed in                          |
| `POST /api/account/login`   | signs a player in                                            |
| `POST /api/account/logout`  | signs a player out                                           |
| `GET /api/account`          | the account of the player                                    |
| `PATCH /api/account`        | changes the name and the email                                |
| `POST /api/account/password` | sets a new password                                         |
| `POST /api/account/card`     | links a card, or takes the card away                          |
| `DELETE /api/account`        | removes the account (the password is asked for)                |

The registration form sends this to `POST /api/register`:

```json
{ "username": "player1", "email": "player1@example.com", "password": "a-good-password", "acceptedTerms": true, "rfidUid": "5A2B3C4D" }
```

`rfidUid` is the card of the player. It may be left out &mdash; somebody can
register without a card.

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

## The RFID card reader

The registration form has a field for the **card of the player**. The number
can be read with a reader or typed by hand. Either way the number is saved
with the account, in the `rfid_uid` column of the `users` table.

A card can only belong to **one** account. The database says so (there is a
unique index on the column), and the form warns about it as well: when a card
is read, the server is asked whether it is still free, and a card that is
already in use turns the field red.

### Which readers work

| Reader                                      | How it is used                                   |
| ------------------------------------------- | ------------------------------------------------ |
| A USB reader that works like a keyboard     | nothing to set up: plug it in and scan          |
| A USB reader that shows up as a serial port | press **Connect a reader** (Chrome or Edge)     |
| No reader at all                            | type the number by hand                          |

The keyboard reader is the easiest one. The computer sees a keyboard, so the
reader types the card number and presses Enter by itself. The form catches
those keys, puts the number in the field and stops the Enter key from sending
the form.

The serial reader is the little one that says "USB Serial" on the sticker.
The browser has to be allowed to open that port, so press **Connect a reader**
and pick it in the list. The button only shows up in browsers that can do it
(Chrome and Edge).

> The keys of the other fields are never taken away from you: a name that is
> typed by hand is not mistaken for a card.

### The card number

The number is cleaned up before it is saved: upper case, no spaces and no
`0x` in front. Some readers print the leading zeros of the card and some do
not, so the leading zeros are dropped &mdash; that way the same card gets the
same number on every reader.

The rules live in **`shared/rfid.js`**, which the client and the server both
use, so they always agree.

### The card in the admin dashboard

The dashboard shows the card of every account, and the search box looks for
it as well. The **Card** button links a card to an account that was made
without one, or takes the card away again.

### The files

| File                                    | What it holds                                   |
| --------------------------------------- | ----------------------------------------------- |
| `shared/rfid.js`                        | the rules of a card number                      |
| `client/src/hooks/useRfidReader.js`     | watches for a card being read                   |
| `client/src/components/RfidField.jsx`   | the card field of the form                      |
| `server/src/services/users.js`          | reads and writes the cards                      |
| `server/src/db/migrations/003_add_rfid_to_users.sql` | the card column        |

## The account page

Every player has an account page at **`/account`**. The tab **ACCOUNT** in the
pill at the top of the site goes there. When nobody is signed in, the page
shows a sign in card that looks exactly like the registration form.

When the player is signed in, the page shows:

| Part                | What is in it                                              |
| ------------------- | ---------------------------------------------------------- |
| the head            | a pixel face, the account number, when the account was made and when the player signed in last |
| **account details** | the account name and the email, both can be changed         |
| **RFID card / ID**  | the card of the player, read with the reader                |
| **password**        | a new password, the old one is asked for first              |
| **danger zone**     | removing the account, the password is asked for first       |

The **account number** (`BS-1A2B3C`) is given to every account and never
changes, so it can be written on a paper and still mean the same thing
tomorrow. The card of the RFID reader is a different thing: it can be linked,
changed and taken away again.

### The sign in

A player signs in with their email and their password. The server then hands
out a cookie with a random token, and only the hash of that token is kept in
the database. That way a stolen database cannot be used to sign in as
somebody else, and the sign in of a player can be ended at any time.

After five wrong tries the sign in is blocked for ten minutes. When the
password is changed, every other sign in of that player is ended.

The cookie is `httpOnly`, so the page cannot read it, and it is sent with
`SameSite=Lax`.

### The files

| File                                    | What it holds                                   |
| --------------------------------------- | ----------------------------------------------- |
| `client/src/pages/AccountPage.jsx`      | the account page                                |
| `client/src/components/AccountSignIn.jsx`| the sign in card                              |
| `client/src/components/AccountDetails.jsx`| the parts of the account                      |
| `client/src/components/PixelAvatar.jsx` | the little pixel face of a player               |
| `client/src/hooks/useAccount.js`        | the account of the player in the browser        |
| `client/src/styles/account.css`         | how the account page looks                      |
| `server/src/routes/account.js`          | the account API                                 |
| `server/src/services/userAuth.js`       | the sign ins of the players                     |
| `server/src/services/cookies.js`        | the cookies of the site                         |
| `server/src/db/migrations/004_create_user_sessions.sql` | the sign ins table   |

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
  this week, how many cards are linked, and how many emails went out (and how
  many failed)
- **a chart** of the new accounts over the last 14 days
- **the system** &mdash; whether the database and the email are working, with
  the PostgreSQL version
- **the accounts** &mdash; with a search box, the card of every player, and a
  button to remove one
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
| `PATCH /api/admin/users/:id/card` | link a card to an account     |
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

## The layout on a phone

The site is made for a phone first, because most of the players will use one.
Everything is measured in `rem`, so the whole layout shrinks together like a
picture instead of breaking apart.

| Width      | What changes                                                  |
| ---------- | ------------------------------------------------------------- |
| under 700px | the navigation becomes a bar across the top of the screen, the tagline moves under the picture, and the fields get a text of 16 pixels so iOS does not zoom in when you tap them |
| under 820px | the logo becomes a little smaller, so it never runs into the navigation |
| under 600px | the dashboard stacks its tiles in two columns and leaves out the long columns of the tables |

The parts you have to touch with a finger (the tabs, the eye of the password,
the checkbox of the terms, the button of the reader) are all at least 34
pixels high on a phone.

## The loader

The grey blocks that appear while the page loads are drawn by measuring the
real layout of the page, so they always line up with the content they stand in
for. The code lives in `client/src/lib/skeleton.js`, the timing is in
`client/src/hooks/useSkeleton.js` (`LOADER_SETTINGS`).

---

# SBIT-3H project
