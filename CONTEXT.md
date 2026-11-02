# Project context: NexaReach frontend

Read this before working on the frontend. The full product plan and backend details live in the backend repo: [docs/Phase1-Plan.md](https://github.com/hammad-qayyum/nexareach-backend/blob/main/docs/Phase1-Plan.md) and [CONTEXT.md](https://github.com/hammad-qayyum/nexareach-backend/blob/main/CONTEXT.md).

## What we're building

An internal web app for FastNexa that sends cold sales emails from the company's own fastnexa.com mailboxes. Staff import lead sheets, verify addresses, resolve duplicates, build campaigns and press Start; the backend worker sends, warms up mailboxes, detects replies and watches deliverability. Every action is logged.

Three roles: **Admin**, **Member**, **Viewer**. The backend enforces permissions; the frontend only hides what a role can't use.

## Repositories

| Repo | Local folder |
|---|---|
| [nexareach-frontend](https://github.com/hammad-qayyum/nexareach-frontend) (this one) | `~/Projects/nexareach/nexareach-frontend` |
| [nexareach-backend](https://github.com/hammad-qayyum/nexareach-backend) | `~/Projects/nexareach/nexareach-backend` |

Both use the `main` branch and are committed and pushed separately.

## Status

**Milestone 1 (Foundation), frontend part: done.**
- Next.js 16 (App Router, TypeScript, Cache Components) with shadcn/ui (Radix, Nova preset), Tailwind 4, TanStack Query, openapi-fetch
- App shell: collapsible sidebar with every Phase 1 page grouped, role-aware (Users is admin only), user menu with theme (light/dark/system) and sign out
- `/login`: password step, then 2FA setup (QR code + manual key) or 2FA code entry; resumes the 2FA step if the password step is already done; honours `?next=`
- `/invite/[token]`: set password, then on to `/login` with the email filled in
- `/users` (admin): list, invite (shows the link to send), edit name and role, pause / reactivate / remove, cancel invite, new invite link, reset 2FA
- `/logs`: filter by action (exact or `auth.`-style group), user (admins), item and date range, all kept in the URL; expandable before/after view; CSV export; pagination
- `/` dashboard: recent activity and system health. Every other Phase 1 page is a "Not built yet" placeholder naming its milestone
- API types generated from the backend (`npm run gen:api`)

**Not done:** the Impeccable design skill wasn't installed, so the UI uses a restrained shadcn base (neutral greys, one blue accent in `globals.css`). Install Impeccable and run its polish pass later (plan milestone 12). No automated frontend tests yet.

**Next:** Milestone 2, Mailboxes (and the `/mailboxes`, `/dnc`, `/settings` pages). Later milestones add Tiptap (email editor) and Recharts (reports).

## How the frontend is built

- **Client-rendered behind the session.** `src/app/(app)/app-shell.tsx` loads `/api/auth/me` and renders the signed-in pages only once the user has passed 2FA. Otherwise it sends them to `/login?next=...`. Pages read the user with `useCurrentUser()` from `src/lib/session.tsx`. `(auth)` holds the signed-out pages.
- **Crossing the sign-in boundary is a full page load** (`goToSignIn`, `signOut`, and the end of login), so no cached data or page state survives between users.
- **API calls:** `api` from `src/lib/api/client.ts` (typed openapi-fetch, adds `X-Requested-With`, sends cookies), wrapped in `unwrap(...)`, which throws an `ApiError` carrying the backend's code and a user-facing message from `src/lib/errors.ts`. Add new error codes there. Any 401 re-checks `/me`, which sends the user to sign-in.
- **Navigation** lives in `src/lib/nav.ts` (title, icon, description, role restriction, milestone). Removing `milestone` from an item drops its "Soon" badge; replace the placeholder `page.tsx` with the real page.
- **Roles:** `isAdmin` / `canEdit` in `src/lib/session.tsx` only hide UI; the backend enforces permissions.
- **Next 16 specifics:** with Cache Components, pages stay mounted (hidden) after you navigate away, so reset transient state on hide where it matters. `useSearchParams` / `useParams` need a `<Suspense>` boundary (see `logs/page.tsx`). Instant-navigation checks run only for segments that export `instant` (set in `next.config.ts`). Read `node_modules/next/dist/docs/` before relying on older Next.js knowledge.

## Stack

Next.js with TypeScript, used for the UI only: all logic, permissions and data live in the FastAPI backend. shadcn/ui, Impeccable design skill, Tiptap, Recharts.

## Talking to the backend

- In production, Caddy serves the frontend at `/` and the API at `/api/*` on the same domain, so requests go to relative `/api/...` URLs. In development, proxy `/api` to `http://localhost:8000` (for example with a Next.js rewrite) so the session cookie stays on the same origin.
- **Session:** an httpOnly cookie `fn_session` set by `POST /api/auth/login`. Send requests with credentials included; the frontend never reads the cookie itself.
- **CSRF:** every non-GET request must send the header `X-Requested-With` (any value, e.g. `fetch`), or the backend returns 403 `csrf_header_missing`.
- **2FA:** admins must use an authenticator app. After login, if 2FA isn't finished, protected endpoints return 401 `mfa_required`; send the user to the 2FA step (`/api/auth/2fa/setup`, `/2fa/enable`, `/2fa/verify`).
- **Errors** come back as short snake_case codes in `detail` (e.g. `not_authenticated`, `forbidden`). Map them to user-facing messages.
- **API reference:** with the backend running, see http://localhost:8000/api/docs. The OpenAPI schema is at `/api/openapi.json`; generate types from it rather than writing them by hand.

Endpoints that exist now:

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/2fa/setup`, `POST /api/auth/2fa/enable`, `POST /api/auth/2fa/verify` |
| Invites | `GET /api/auth/invites/{token}`, `POST /api/auth/invites/{token}/accept` |
| Users (admin) | `GET /api/users`, `POST /api/users/invite`, `PATCH /api/users/{id}`, `POST /api/users/{id}/resend-invite`, `POST /api/users/{id}/reset-2fa` |
| Logs | `GET /api/logs`, `GET /api/logs/actions`, `GET /api/logs/export` |
| Health | `GET /api/health` |

## Pages in Phase 1

`/login`, `/` (dashboard), `/leads/import`, `/leads/groups`, `/leads/groups/[id]`, `/leads/duplicates`, `/campaigns`, `/campaigns/new`, `/campaigns/[id]`, `/replies`, `/mailboxes`, `/warmup`, `/deliverability`, `/dnc`, `/logs`, `/settings`, `/users`. See plan section 23.

## Running the backend locally

From `~/Projects/nexareach/nexareach-backend`, follow the "Local development" section of its CONTEXT.md. You need Docker Desktop running (Postgres on port 5433) and an admin created with `.venv/bin/python -m app.cli create-admin`.
