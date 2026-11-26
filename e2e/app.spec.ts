import { expect, test } from "@playwright/test";
import { MEMBER, PASSWORD, VIEWER, signIn } from "./helpers";

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#email", MEMBER);
  await page.fill("#password", `${PASSWORD}-wrong`);
  await page.click("button[type=submit]");
  await expect(page.getByText("That email and password don't match an active account.")).toBeVisible();
});

test("a member signs in to the development copy", async ({ page }) => {
  await signIn(page, MEMBER);
  await expect(page.getByText("Development", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Campaigns" }).first()).toBeVisible();
});

test("a viewer can look but not change anything", async ({ page }) => {
  await signIn(page, VIEWER);
  await page.goto("/campaigns");
  await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible();
  await expect(page.getByRole("link", { name: "New campaign" })).toHaveCount(0);
  await page.goto("/mailboxes");
  await expect(page.getByText("sender1@example.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add mailbox" })).toHaveCount(0);
});

test("a campaign with a follow-up is previewed and saved as a draft", async ({ page }) => {
  await signIn(page, MEMBER);
  const name = `E2E follow-up ${Date.now()}`;
  await page.goto("/campaigns/new");
  await page.fill("#c-name", name);
  await page.getByLabel("Real estate agents (sample)").check();
  await page.getByRole("checkbox", { name: /sender1@example.com/ }).check();
  await page.fill("#c-subject", "Quick question about {{area|your area}}");
  await page.fill("#c-body", "Hi {{first_name|there}},\n\nA first email.\n\n{{sender_name}}");

  // Follow-ups are optional and start switched off.
  await expect(page.getByLabel("Days to wait before follow-up 1")).toHaveCount(0);
  await page.getByLabel("Send follow-ups to people who don't reply").check();
  await expect(page.getByLabel("Days to wait before follow-up 1")).toHaveValue("3");
  await page.getByLabel("Follow-up 1 message").fill("Hi {{first_name|there}}, just checking in.");
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText(/^Re: Quick question about/).first()).toBeVisible();

  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  // Next.js keeps the page we came from mounted but hidden: look at the visible form only.
  await expect(page.getByLabel("Follow-up 1 message").filter({ visible: true })).toHaveValue(
    "Hi {{first_name|there}}, just checking in.",
  );
});

test("reports show replies and follow-ups", async ({ page }) => {
  await signIn(page, MEMBER);
  await page.goto("/reports");
  await expect(page.getByText("Emails sent")).toBeVisible();
  await expect(page.getByText("Replied", { exact: true })).toBeVisible();
});

test("the Replies page opens with its filters", async ({ page }) => {
  await signIn(page, MEMBER);
  await page.getByRole("link", { name: "Replies" }).first().click();
  await expect(page).toHaveURL("/replies");
  const show = page.getByRole("navigation", { name: "Show" });
  for (const filter of ["To do", "Unread", "Done", "All"]) await expect(show.getByRole("button", { name: filter })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(page.getByLabel("Search replies")).toBeVisible();
});
