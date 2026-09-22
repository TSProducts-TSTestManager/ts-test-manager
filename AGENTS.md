## Quick orientation for AI coding agents — TSTestManager Frontend (ts-test-manager)

This repo is **TSTestManager Frontend** — React + Vite + TypeScript (standalone). Backend is separate repo **ts-test-manager-backend**.

- Architecture at a glance
  - Entry: `src/main.tsx` → `src/App.tsx`. Build: `vite build` → `dist/`.
  - Served via `nginx` (Dockerfile `nginx:alpine` + `nginx.conf`) or `vite preview` on Hostinger.
  - API connects to backend via `VITE_API_URL` / `VITE_DEV_API_URL` (see `src/utils/api.ts`).

- Important runtime contracts
  - Auth cookie `token` comes from backend `ts-test-manager-backend`; frontend sends `withCredentials: true` on all `API_URL` calls.
  - Real-time via `src/services/socket.ts` (Socket.io client) → backend `ts-test-manager-backend` at `VITE_API_URL`.

- Dev / build commands
  - Dev: `npm run dev` (Vite on 5173)
  - Build: `npm run build` (tsc + vite)
  - Lint: `npm run lint`, `npm run type-check`

- Environment variables (frontend)
  - `VITE_API_URL` (production backend URL, e.g. `https://api.yourdomain.com/api`)
  - `VITE_DEV_API_URL` (dev, default `/api` proxied)

- Patterns
  - **ALWAYS** use `API_URL` from `src/utils/api.ts` for API calls
  - **NEVER** hardcode `/api/...`
  - Zustand stores: `src/store/authStore.ts`, `src/store/testManagerStore.ts`

- Quick places to look
  - API services: `src/services/testManagerApi.ts`, `src/services/socket.ts`
  - Stores: `src/store/*`
  - Tests: `src/__tests__/`

- Checklist before PR
  1. Update `.env.example` if VITE var changed
  2. Run `npm run lint` + `npm run type-check`
  3. Backend changes must be PR’d to `ts-test-manager-backend` separately
