import type { User } from "./api/types";

export function safeReturnTo(
  value: string | null | undefined,
  fallback = "/dashboard"
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (
    value.startsWith("/login") ||
    value.startsWith("/signup") ||
    value.startsWith("/auth/callback")
  ) {
    return fallback;
  }
  return value;
}

export function postAuthDestination(
  user: User,
  returnTo: string | null | undefined = "/dashboard"
): string {
  if (!user.onboarding_completed) return "/onboarding";
  return safeReturnTo(returnTo);
}
