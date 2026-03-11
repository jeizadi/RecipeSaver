# Recipebox (Next.js)

Recipe collection app: save recipes from any link, search by title/ingredient/category, and share via a single URL. Free to host on Vercel + Supabase/Neon. Repo: **RecipeSaver**.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Prisma** + **PostgreSQL** (Neon or Vercel Postgres)
- **Tailwind CSS**

## Local development

### 1. Database (free)

Create a free PostgreSQL database:

- **[Neon](https://neon.tech)** – sign up, create a project, copy the connection string.
- Or **[Vercel Postgres](https://vercel.com/storage/postgres)** – create a store and copy `POSTGRES_URL`.

### 2. Env and DB setup

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL to your Postgres connection string (with ?sslmode=require for Neon).

npx prisma migrate dev   # create tables
npm run dev              # start Next.js
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Import from URL

On **Add recipe**, paste a recipe or video URL and click **Import**. The app will try to fill fields from JSON-LD or OpenGraph (and from video descriptions on YouTube/Vimeo).

## Deploy for free (shareable URL)

### Deploy to Vercel (step-by-step)

1. **Push the app to GitHub**
   - Create a new repo named **RecipeSaver** on GitHub (or use an existing repo).
   - In Terminal, from the app folder (e.g. `bakebox-web` or `RecipeSaver`):
     ```bash
     git add .
     git commit -m "Recipebox recipe app"
     git remote add origin https://github.com/YOUR_USERNAME/RecipeSaver.git   # if not already added
     git push -u origin main
     ```
   - If your repo root is the **parent** of this app folder, in Vercel set **Root Directory** to the app folder name (see step 3).

2. **Run migrations** (if you haven’t already)
   - From the app folder: `npx prisma migrate deploy`
   - Your Supabase (or Neon) database now has the `recipes` table.

3. **Import and deploy on Vercel**
   - Go to [vercel.com/new](https://vercel.com/new) and sign in (e.g. with GitHub).
   - **Import** your GitHub repo.
   - If the repo root is the parent of the app folder, set **Root Directory** to that folder and click **Edit** so builds run from it.
   - **Environment Variables:** add one:
     - **Name:** `DATABASE_URL`
     - **Value:** the **same** connection string you use in `.env` (e.g. your Supabase **Session** pooler URI with `?sslmode=require`).
   - Click **Deploy**.

4. **Open your app**
   - When the build finishes, open the URL Vercel gives you (e.g. `https://recipe-saver-xxx.vercel.app`). You can share that link so others can view and add recipes.

**Supabase users:** Use the **Session** pooler connection string (from Connect → Session) so it works over IPv4. Set that as `DATABASE_URL` in Vercel; you don’t need `DIRECT_URL` on Vercel (only for running `prisma migrate deploy` locally).

### Supabase (connection and auth)

If you use **Supabase**, you need two URLs so the app uses the pooler and migrations use a direct connection:

1. In Supabase: **Project Settings → Database**. Copy the **Database password** (or reset it if you’re not sure). Use this password in both URLs below; if it contains `@`, `#`, `&`, `=`, etc., [URL-encode](https://www.w3schools.com/tags/ref_urlencode.asp) them (e.g. `@` → `%40`).
2. In Dashboard: **Connect**.
   - **Transaction (pooler)** – copy the URI, add `?pgbouncer=true` at the end → set as **`DATABASE_URL`** in `.env` and in Vercel.
   - **Direct connection** – copy the URI, add `?sslmode=require` → set as **`DIRECT_URL`** in `.env` (used only for `prisma migrate deploy`).

**.env (Supabase):**
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
```

If you see **“password authentication failed”**: use the password from **Project Settings → Database** (not your Supabase account password), or reset the database password there and update both URLs.

If you use **Neon** or a single connection string, set both `DATABASE_URL` and `DIRECT_URL` to the same value.

### Optional: Vercel Postgres

Instead of Neon, you can use Vercel Postgres from the same project: create a Postgres store, connect the project, and use the provided `POSTGRES_URL` as `DATABASE_URL` (and set `DIRECT_URL` to the same).

## Scripts

- `npm run dev` – local dev server
- `npm run build` – production build
- `npm run start` – run production build locally
- `npx prisma generate` – regenerate Prisma client (run after pull if schema changed)
- `npx prisma migrate dev` – create and apply migrations (local)
- `npx prisma migrate deploy` – apply migrations (production)

## Data

- All data is stored in your Postgres database.
- To back up: use your provider’s backup or `pg_dump`.
- No auth is included by default: anyone with the URL can view and add recipes. Add auth (e.g. NextAuth) if you want to restrict who can edit.
