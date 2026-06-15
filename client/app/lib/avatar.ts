import { api } from "./api/endpoints";

export function avatarImageUrl(value: string | null): string | null {
  if (!value) return null;
  if (value.startsWith("/api/v1/me/avatar")) {
    return `${api.me.avatarUrl()}${value.slice("/api/v1/me/avatar".length)}`;
  }
  return value;
}
