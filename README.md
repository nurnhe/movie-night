# Movie Night Queue

A shared watchlist for a few friends. Add movies, TV shows and anime by searching TMDB (poster, rating, runtime, genres and, for series, seasons and episodes fill in automatically), add your own tags (like "cozy" or "date night") alongside TMDB's genres, filter by type, tag, length or rating, let the app pick a random title that fits, and track each one as **To watch**, **Watching** or **Watched**. After watching, each person can rate a title 1-5 stars, and **Suggestions** recommends new ones from TMDB based on your own ratings. Everyone sees changes live.

TMDB has no anime category, so anything that is Japanese-language animation (series or film) is labelled **Anime**; other TV is a **TV show**. The **Type** filter separates Movies, TV shows and Anime.

When you add a title, **Share with** decides who sees it: **Everyone**, **Only me**, or one of your **groups**. Whoever added a movie can change that later from its card, and ratings and tags come along. The **List** filter narrows the list to everything you can see, titles shared with everyone, your private ones, or one group's. Anyone can create a group from the filter menu and pick people from everyone on the `members` list; any member can rename it, add or remove people, or leave (the last member can delete it). Movies shared with everyone live in the `movies` collection; private and group ones in `restricted`, where the rules only let the owner or that group's members see them.

Unwatched titles also show **On Netflix** / **On HBO Max** badges when they're included with a subscription in Serbia, and the **Streaming in Serbia** filter narrows the list to them. Availability comes from TMDB's watch-provider data (supplied by JustWatch), is looked up when the app opens, and is kept for a day in each person's browser only, never in the shared database. To use another country, change `REGION` in `src/lib/availability.ts`.

- **Frontend:** React + Vite, deployed to GitHub Pages as an installable web app (manifest, icons and service worker in `public/`)
- **Shared list and sign-in:** Firebase (Cloud Firestore, email sign-in links, live updates), free Spark plan
- **Movie data:** [TMDB](https://www.themoviedb.org/) API. Letterboxd has no public API, so each movie links to its Letterboxd page instead (Letterboxd uses TMDB ids too).

## Installing it on a phone

The site is an installable web app, so everyone on the `members` list can put it on their home screen and open it full screen like any other app. Nothing goes through an app store, and updates arrive whenever you push to `main`.

- **Android (Chrome, Edge, Samsung Internet):** open the site, sign in, and tap **Install app** at the top (or **Add to Home screen** / **Install app** in the browser menu).
- **iPhone and iPad:** open the site in Safari (or Chrome on iOS 16.4+), tap **Share**, then **Add to Home Screen**. The **Install app** button shows these steps too.

Things to know:
- On iPhone the home-screen app keeps its own sign-in, separate from Safari, so sign in again inside it. Use the **password**: an emailed sign-in link opens in Safari rather than in the installed app.
- The app's own files are cached on the phone, so it opens without a connection, but the list itself needs one. Firebase and TMDB requests are never cached by the app.
- Who sees each title works the same as on the website: **Only me** titles show up only for you, on any of your devices, and **Everyone** titles for all members. The Firestore rules enforce this, not just the app.

If you change anything in `public/sw.js`, bump `CACHE` at its top so phones drop the old copy.

## Setup

### 1. Firebase (the shared list)
1. Create a project at [console.firebase.google.com](https://console.firebase.google.com) (Google Analytics can stay off). The free Spark plan is enough.
2. **Security > Authentication > Get started > Sign-in method** (older consoles: **Build > Authentication**): enable **Email/Password**, then turn on **Email link (passwordless sign-in)** inside it and save.
3. Still in Authentication, open **Settings > Authorized domains** and add `<user>.github.io`. `localhost` is already there for local development.
4. **Databases and storage > Firestore > Create database** (older consoles: **Build > Firestore Database**): pick a location near you and start in **production mode**.
5. In Firestore's **Rules** tab, replace everything with the contents of [`firestore.rules`](firestore.rules) and click **Publish**.
6. In Firestore's **Data** tab, list everyone who can use the app: **Start collection**, collection ID `members`, then add one document per person with the **email address in lowercase as the Document ID** (e.g. `you@example.com`). Add a `name` field if you want, though anyone can also set their own from the app once they've signed in. Only these emails can see or change the list.
7. Create an account for each person: **Authentication > Users > Add user**, with their email and a password. Each person can sign in with that password, or use **Email me a sign-in link instead** on the sign-in screen.
8. Turn off sign-ups so nobody else can create an account: **Authentication > Settings > User actions**, uncheck **Enable create (sign-up)** and save.
9. **Project settings (gear icon) > General > Your apps**: click the **Web** (`</>`) icon, register an app (no Hosting needed), and copy `apiKey`, `authDomain`, `projectId` and `appId` from the config it shows.

The first time each person signs in with a password, the app asks them to confirm their email with a one-time verification link. Signing in with an email link confirms it automatically.

To add someone later, do steps 6 and 7 for them. Adding them to a group in the app only changes that group's filter.

These Firebase values end up in the site's JavaScript. That's by design: access is controlled by the Firestore rules, not by keeping the config secret.

### 2. TMDB (movie details)
Create a free account at [themoviedb.org](https://www.themoviedb.org/signup), request an API key under **Settings > API**, and copy the **API Read Access Token**.

The token also ends up in the site's JavaScript, so anyone who opens the site can read it. It only allows reading TMDB data, but use one you're happy to revoke and replace.

#### Keeping within TMDB's terms
The app follows [TMDB's API terms](https://www.themoviedb.org/api-terms-of-use). If you change it, keep these in place:
- **Non-commercial only.** The free key doesn't allow charging for the app, showing ads, or otherwise earning from it.
- **Attribution.** The footer shows TMDB's official logo (`public/tmdb-logo.svg`, unmodified, and smaller than the app's own title) and the exact notice the terms require. Don't reword the notice.
- **JustWatch credit.** TMDB's watch-provider data must be credited to JustWatch, so the footer says so. Keep that line while the availability badges exist.
- **Six-month limit.** TMDB doesn't allow keeping its data longer than six months, but titles are saved in Firestore. Each title records when its TMDB details were fetched (`tmdb_synced_at`). Whenever someone opens the app, it re-fetches up to 30 titles whose details are a month old or more (oldest first) and updates only the TMDB-supplied fields, never notes, tags, ratings or watched state. If TMDB no longer has a title and its details are 150 days old, they're cleared (the name and year stay). The refresh only runs when the app is opened, so if nobody opens it for months the saved copy can age past the limit until the next visit.

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
`npm test` runs the unit tests (filters, random pick, group membership helpers); `npm run build` typechecks and builds.
