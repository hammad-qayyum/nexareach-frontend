# Browser tests

Playwright tests that click through the app in Chromium, against the **development copy** running on this
computer. They don't start anything themselves.

1. Start the backend's database, API and worker, and `npm run dev` here (see the backend README).
2. The sample users must exist: run `.venv/bin/python -m app.cli reset-dev` in the backend once.
3. First time only: `npx playwright install chromium`.
4. Run `npm run test:e2e`. Add `-- --headed` to watch the browser.

They sign in as `member@example.com` and `viewer@example.com` (no 2-step sign-in needed). To see replies
on a laptop, fake one with `.venv/bin/python -m app.cli simulate-reply <lead email>` in the backend. The campaign
test leaves a draft named "E2E follow-up …" behind; `reset-dev` clears everything. To test another
address, set `E2E_BASE_URL`, e.g. `E2E_BASE_URL=http://localhost:3001 npm run test:e2e`.
