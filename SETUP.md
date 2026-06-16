# World Cup 26 Arena — Shared Online Setup

This app works two ways:

- **Local mode (default):** leave `supabase-config.js` blank → everything saves to
  your own browser (`localStorage`), no login. Great for development.
- **Shared mode:** fill in `supabase-config.js` → one common live dataset, magic-link
  login to view, and only **admins** (you + anyone you allow) can edit. Everyone sees
  edits in real time.

Follow the steps below once to turn on shared mode.

---

## 1. Create a Supabase project (free)

1. Go to <https://supabase.com> → sign up → **New project**.
2. Pick a name + a database password (you won't need the password day-to-day).
3. Wait ~2 minutes for it to provision.

## 2. Create the tables + security rules

In the Supabase dashboard open **SQL Editor → New query**, paste **all** of this, and
click **Run**:

```sql
-- One row holds the entire app state as a JSON blob.
create table if not exists public.app_state (
  id          int primary key default 1,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
insert into public.app_state (id, data)
  values (1, '{}'::jsonb)
  on conflict (id) do nothing;

-- The edit allow-list. Add a row per admin email.
create table if not exists public.admins (
  email text primary key
);

-- 👇 CHANGE THIS to your email. Add more lines for co-admins.
insert into public.admins (email) values
  ('kimjorg2001@gmail.com')
  on conflict (email) do nothing;

-- Turn on Row Level Security.
alter table public.app_state enable row level security;
alter table public.admins    enable row level security;

-- Any signed-in user may READ the shared state and the admin list.
create policy "read state" on public.app_state
  for select to authenticated using (true);
create policy "read admins" on public.admins
  for select to authenticated using (true);

-- Only admins may INSERT/UPDATE the shared state.
create policy "admins write state (insert)" on public.app_state
  for insert to authenticated
  with check (lower(auth.jwt() ->> 'email') in (select lower(email) from public.admins));
create policy "admins write state (update)" on public.app_state
  for update to authenticated
  using  (lower(auth.jwt() ->> 'email') in (select lower(email) from public.admins))
  with check (lower(auth.jwt() ->> 'email') in (select lower(email) from public.admins));
```

> To add or remove admins later, just edit the `admins` table (Table editor → admins).

## 3. Enable realtime on `app_state`

Dashboard → **Database → Replication** (or **Table editor → app_state → ⋯ → Realtime**)
→ make sure realtime is **on** for `public.app_state`. This is what pushes live updates
to viewers.

## 4. Turn on magic-link email login

Dashboard → **Authentication → Providers → Email**:
- Enable **Email**.
- Turn **OFF** "Confirm email" is not required, but **leave magic links enabled**
  (the default email sign-in supports the one-click link this app uses).

Dashboard → **Authentication → URL Configuration**:
- **Site URL:** your live URL (e.g. `https://YOURNAME.github.io/worldcup-app/`).
- **Redirect URLs:** add both:
  - `http://localhost:8765` (and `http://localhost:8765/index.html`) for local testing
  - your GitHub Pages URL (and `.../index.html`)

## 5. Paste your keys into the app

Dashboard → **Project Settings → API**. Copy:
- **Project URL**
- **anon public** key (the long one — it's meant to be public; RLS protects your data)

Open `supabase-config.js` and fill them in:

```js
window.SUPABASE_CONFIG = {
  url: "https://YOURPROJECT.supabase.co",
  anonKey: "eyJhbGciOi...your anon public key...",
};
```

That's it — reload the app and you'll get the sign-in screen.

---

## 6. Publish it (GitHub Pages)

So friends can open it (and optionally help with the code):

1. Create a new **empty** repo on <https://github.com/new> (e.g. `worldcup-app`).
   Don't add a README/license (the project already has files).
2. In this folder, push it:
   ```bash
   git init
   git add -A
   git commit -m "World Cup 26 Arena"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/worldcup-app.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a
   branch → Branch: `main` / root → Save**. After a minute your URL is live at
   `https://YOURNAME.github.io/worldcup-app/`.
4. Put that URL into Supabase **Site URL / Redirect URLs** (step 4) if you hadn't yet.
5. To let friends edit the **code**: **Settings → Collaborators → add them**, or they
   fork the repo and open pull requests.

---

## How it behaves

| | Signed out | Signed in (viewer) | Signed in (admin) |
|---|---|---|---|
| See standings/brackets/stats | — (login screen) | ✅ live | ✅ live |
| Enter results / predictions / bracket / bank | — | ❌ hidden | ✅ |
| Import JSON | — | ❌ hidden | ✅ |

Security is enforced by the database (RLS), not just the UI — a viewer literally
cannot write, even with dev tools.

## Notes & troubleshooting

- **Magic link didn't arrive?** Supabase's built-in email has low rate limits; for a
  small friend group it's fine, but check spam, and for heavier use add a custom SMTP
  provider in Auth settings.
- **"Invalid redirect URL"** on clicking the email link → the URL you're opening the
  app from isn't in **Redirect URLs** (step 4). Add it exactly (including `/index.html`).
- **Want to keep using it offline / locally?** Blank out `supabase-config.js` again and
  it falls back to localStorage with full edit access.
- The first admin to enter data seeds the shared `app_state`; from then on everyone
  reads the same blob and admins overwrite it (safe, since only admins write).
