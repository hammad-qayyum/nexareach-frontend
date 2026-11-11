import createClient, { type Middleware } from "openapi-fetch";
import { errorMessage } from "@/lib/errors";
import type { components, paths } from "./schema";

export type Schemas = components["schemas"];
export type User = Schemas["UserOut"];
export type Role = Schemas["Role"];
export type UserStatus = Schemas["UserStatus"];
export type ActivityLog = Schemas["ActivityLogOut"];
export type MfaState = Schemas["MeOut"]["mfa"];
export type Mailbox = Schemas["MailboxOut"];
export type SmtpSecurity = Schemas["MailboxOut"]["smtp_security"];
export type MailboxStatus = Schemas["MailboxOut"]["status"];
export type Group = Schemas["GroupOut"];
export type Lead = Schemas["LeadOut"];
export type Campaign = Schemas["CampaignOut"];
export type CampaignStatus = Schemas["CampaignOut"]["status"];
export type Recipient = Schemas["RecipientOut"];
export type RecipientStatus = Schemas["RecipientOut"]["status"];
export type DncEntry = Schemas["DncOut"];

/** A failed API call. `code` is the backend's snake_case `detail` (e.g. "forbidden"). */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const csrf: Middleware = {
  onRequest({ request }) {
    // The backend rejects any non-GET request without this header (CSRF guard).
    request.headers.set("X-Requested-With", "fetch");
    return request;
  },
};

export const api = createClient<paths>({ baseUrl: "", credentials: "include" });
api.use(csrf);

function toApiError(status: number, error: unknown): ApiError {
  const detail = (error as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return new ApiError(status, detail, errorMessage(detail));
  // FastAPI validation errors: a list of { loc, msg }.
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { loc?: unknown[]; msg?: string };
    const field = String(first.loc?.at(-1) ?? "").replaceAll("_", " ");
    // Pydantic messages can run on ("value is not a valid email address: The part after..."); keep the gist.
    const msg = first.msg?.split(": ")[0];
    const text = msg ? (field ? `${field[0].toUpperCase()}${field.slice(1)}: ${msg}` : msg) : errorMessage("validation_error");
    return new ApiError(status, "validation_error", text);
  }
  return new ApiError(status, "unknown", errorMessage(status >= 500 ? "server_error" : "unknown"));
}

/**
 * Unwraps an openapi-fetch result: returns the data or throws an ApiError.
 * Use as `unwrap(await api.GET("/api/users"))`, or pass the promise directly.
 */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let result: Awaited<typeof call>;
  try {
    result = await call;
  } catch {
    throw new ApiError(0, "network_error", errorMessage("network_error"));
  }
  if (!result.response.ok) throw toApiError(result.response.status, result.error);
  return result.data as T;
}
