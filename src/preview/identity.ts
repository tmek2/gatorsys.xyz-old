import type { Session } from "next-auth";

export const PREVIEW_COOKIE = "dashboard-preview-visitor";
export const PREVIEW_USER_ID = "100000000000000001";
export const PREVIEW_GUILDS = [
  { id: "100000000000000101", name: "Harbor Community", members: 1284 },
  { id: "100000000000000102", name: "Cedar Gaming", members: 486 },
  { id: "100000000000000103", name: "Northstar Network", members: 2489 },
] as const;
export const PREVIEW_SESSION: Session = {
  user: { id: PREVIEW_USER_ID, name: "Dev User", email: null, image: "/preview/avatar.svg" },
  expires: "2099-01-01T00:00:00.000Z",
};
