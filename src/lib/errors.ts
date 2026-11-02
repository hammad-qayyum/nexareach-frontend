// User-facing text for the backend's error codes (the `detail` field).
const MESSAGES: Record<string, string> = {
  not_authenticated: "Your session has ended. Sign in again.",
  mfa_required: "Finish 2-step sign-in to continue.",
  forbidden: "You don't have permission to do that.",
  csrf_header_missing: "The request was blocked. Refresh the page and try again.",
  invalid_credentials: "That email and password don't match an active account.",
  too_many_attempts: "Too many failed attempts. Wait 15 minutes and try again.",
  invalid_code: "That code didn't work. Check your authenticator app and try again.",
  already_enabled: "2-step sign-in is already set up for this account.",
  setup_not_started: "Start the 2-step sign-in setup again.",
  not_enabled: "2-step sign-in isn't turned on for this account.",
  invite_invalid: "This invite link is invalid, expired or already used. Ask an admin for a new one.",
  email_exists: "Someone with this email already has an account.",
  cannot_change_own_role_or_status: "You can't change your own role or status.",
  invalid_status: "That status can't be set directly.",
  invite_not_accepted: "This person hasn't accepted their invite yet.",
  not_invited: "This person has already accepted their invite.",
  cannot_reset_own_2fa: "You can't reset your own 2-step sign-in.",
  user_not_found: "That user no longer exists.",
  validation_error: "Some of the values aren't valid.",
  network_error: "Can't reach the server. Check your connection and try again.",
  server_error: "Something went wrong on the server. Try again in a moment.",
  unknown: "Something went wrong. Try again.",
};

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? MESSAGES.unknown;
}
