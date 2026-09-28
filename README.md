# Movie Night Queue

A shared watchlist for two. Add movies by searching TMDB (poster, rating, runtime and genres fill in automatically), filter by genre, length, rating or who added it, let the app pick a random movie that fits, and mark movies as watched. Both people see changes live.

- **Frontend:** React + Vite, deployed to GitHub Pages
- **Shared list and sign-in:** Supabase (Postgres, email sign-in links, realtime), free tier
- **Movie data:** [TMDB](https://www.themoviedb.org/) API. Letterboxd has no public API, so each movie links to its Letterboxd page instead (Letterboxd uses TMDB ids too).

## Setup

### 1. Supabase (the shared list)
1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. Add the two people who share the list:
   ```sql
   insert into public.members (email) values ('you@example.com'), ('partner@example.com');
   ```
   Only these emails can read or change the list.
4. In **Authentication > URL Configuration**, set **Site URL** to your GitHub Pages address (for example `https://<user>.github.io/<repo>/`) and add `http://localhost:5173` to **Redirect URLs** for local development.
5. Copy the **Project URL** and **anon public key** from **Project Settings > API**.

### 2. TMDB (movie details)
Create a free account at [themoviedb.org](https://www.themoviedb.org/signup), request an API key under **Settings > API**, and copy the **API Read Access Token**.

The token ends up in the site's JavaScript, like the Supabase anon key. That's normal for TMDB's read-only access, but don't reuse a token you care about.

### 3. GitHub Pages
1. In the repo, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
2. In **Settings > Secrets and variables > Actions**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_TMDB_TOKEN`.
3. Push to `main` (or run the workflow by hand). The site deploys to `https://<user>.github.io/<repo>/`.

## Local development
```sh
cp .env.example .env.local   # fill in the three values
npm install
npm run dev
```
`npm test` runs the filter and random-pick tests; `npm run build` typechecks and builds.
