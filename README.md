# Movie Night Queue

A shared watchlist for two. Add movies by searching TMDB (poster, rating, runtime and genres fill in automatically), filter by genre, length, rating or who added it, let the app pick a random movie that fits, and mark movies as watched. Both people see changes live.

- **Frontend:** React + Vite, deployed to GitHub Pages
- **Shared list and sign-in:** Firebase (Cloud Firestore, email sign-in links, live updates), free Spark plan
- **Movie data:** [TMDB](https://www.themoviedb.org/) API. Letterboxd has no public API, so each movie links to its Letterboxd page instead (Letterboxd uses TMDB ids too).

## Setup

### 1. Firebase (the shared list)
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) (Google Analytics can stay off). The free Spark plan is enough.
2. **Security > Authentication > Get started > Sign-in method** (older consoles: **Build > Authentication**): enable **Email/Password**, then turn on **Email link (passwordless sign-in)** inside it and save.
3. Still in Authentication, open **Settings > Authorized domains** and add `<user>.github.io`. `localhost` is already there for local development.
4. **Databases and storage > Firestore > Create database** (older consoles: **Build > Firestore Database**): pick a location near you and start in **production mode**.
5. In Firestore's **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules) and click **Publish**.
6. In Firestore's **Data** tab, add the two people who share the list: **Start collection**, collection ID `members`, then add one document per person with the **email address in lowercase as the Document ID** (e.g. `you@example.com`). The document needs no fields; if the console insists, add any field such as `name`. Only these emails can read or change the list.
7. Create the two accounts: **Authentication > Users > Add user**, once per person, with their email and a password. Each person can sign in with that password, or use **Email me a sign-in link instead** on the sign-in screen.
8. Turn off sign-ups so nobody else can create an account: **Authentication > Settings > User actions**, uncheck **Enable create (sign-up)** and save.
9. **Project settings (gear icon) > General > Your apps**: click the **Web** (`</>`) icon, register an app (no Hosting needed), and copy `apiKey`, `authDomain`, `projectId` and `appId` from the config it shows.

The first time each person signs in with a password, the app asks them to confirm their email with a one-time verification link. Signing in with an email link confirms it automatically.

These Firebase values end up in the site's JavaScript. That's by design: access is controlled by the Firestore rules, not by keeping the config secret.

### 2. TMDB (movie details)
Create a free account at [themoviedb.org](https://www.themoviedb.org/signup), request an API key under **Settings > API**, and copy the **API Read Access Token**.

The token also ends up in the site's JavaScript. That's normal for TMDB's read-only access, but don't reuse a token you care about.

### 3. GitHub Pages
1. In the repo, go to **Settings > Pages** and set **Source** to **GitHub Actions**.
2. In **Settings > Secrets and variables > Actions**, add these repository secrets:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_TMDB_TOKEN`
3. Push to `main` (or run the workflow by hand). The site deploys to `https://<user>.github.io/<repo>/`.

## Local development
```sh
cp .env.example .env.local   # fill in the five values
npm install
npm run dev
```
`npm test` runs the filter and random-pick tests; `npm run build` typechecks and builds.
