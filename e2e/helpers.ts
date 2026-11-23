import { expect, type Page } from "@playwright/test";

// Users created by `python -m app.cli seed-dev` (or reset-dev) in the backend.
export const PASSWORD = "devpassword123";
export const MEMBER = "member@example.com";
export const VIEWER = "viewer@example.com";

/** Sign in as a user without 2-step sign-in (members and viewers; the dev admin needs a code). */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await expect(page).toHaveURL("/");
}
