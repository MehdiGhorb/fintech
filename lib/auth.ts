import { cookies } from "next/headers";

export const AUTH_COOKIE = "desk_auth";
export const AUTH_VALUE = "ok";

export function isAuthed() {
  return cookies().get(AUTH_COOKIE)?.value === AUTH_VALUE;
}
