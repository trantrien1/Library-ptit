# Library PTIT Web

Next.js frontend for `Library-ptit`, rebuilt on top of the `shacn-nextjs-dashboard` UI and connected to the existing FastAPI backend.

## Environment

- Recommended Node.js: `22 LTS`
- Minimum practical version for this project: `20.9`
- Do not use Node `25.x` here. On this machine, `next dev` with Node `v25.7.0` produced broken `.next` artifacts such as missing `vendor-chunks/next.js`, `8548.js`, and `fallback-build-manifest.json`.

## Main structure

- `app/(auth)`: `login`, `register`
- `app/(dashboard)/admin`: `dashboard`, `books`, `users`, `borrows`
- `app/(dashboard)/user`: `dashboard`, `books`, `wishlist`, `borrows`, `chatbot`
- `lib/api-client.ts`: FastAPI client
- `components/providers/auth-provider.tsx`: auth state with browser storage

## Run locally

1. Start the FastAPI backend from the root `Library-ptit` folder:

```powershell
python main.py
```

2. Create the frontend env file:

```powershell
Copy-Item .env.local.example .env.local
```

3. Install dependencies and run Next.js:

```powershell
npm.cmd install
npm.cmd run dev
```

Frontend runs at `http://localhost:3000`.

## If you use nvm

Switch to Node 22 before installing or running:

```powershell
nvm install 22
nvm use 22
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules
npm.cmd install
npm.cmd run dev
```

## Environment variables

- `NEXT_PUBLIC_API_ROOT`: backend root host
- `NEXT_PUBLIC_API_BASE_URL`: API base URL

Defaults:

```env
NEXT_PUBLIC_API_ROOT=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api
```

## Notes

- The old HTML frontend in `../frontend` is still kept for reference.
- FastAPI still mounts the old frontend at `/static`; the new Next.js frontend runs separately.
- Type-check passes with:

```powershell
node_modules\.bin\tsc.cmd --noEmit --incremental false
```

- Production build passes with:

```powershell
npm.cmd run build
```
