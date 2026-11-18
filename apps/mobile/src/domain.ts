export type Role = "resident" | "guard";
export type VisitStatus =
  "pending" | "approved" | "denied" | "inside" | "exited";
export type VisitType = "guest" | "delivery" | "cab" | "service";
export interface Visitor {
  id: string;
  community_id: string;
  unit_id: string;
  unit: string;
  name: string;
  phone: string;
  type: VisitType;
  status: VisitStatus;
  created_at: string;
  approved_at?: string;
  denied_at?: string;
  entered_at?: string;
  exited_at?: string;
  company?: string;
  purpose?: string;
  people: number;
  vehicle?: string;
  photo_url?: string;
}
export interface Membership {
  id: string;
  community_id: string;
  unit_id?: string;
  unit?: string;
  role: string;
  status: string;
}
export interface Community {
  id: string;
  name: string;
  city?: string;
}
export interface Unit {
  id: string;
  label: string;
}
export interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
  entry_id?: string;
  read_at?: string;
}
export interface VisitorPass {
  entry_id: string;
  community_id: string;
  code: string;
  expires_at: string;
}
export type Kind = "property" | "listing" | "service" | "post" | "notice";
export interface Item {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  category: string;
  price: number;
  author: string;
  author_id: string;
  community: string;
  unit?: string;
  bedrooms?: number;
  available_on?: string;
  listing_type?: string;
  photo_url?: string;
  status: string;
  saved: boolean;
  comments?: { id: string; author: string; body: string }[];
}
export interface Page<T> {
  items: T[];
  next_cursor?: string | null;
}
export interface Activity {
  id: string;
  title: string;
  unit?: string;
  scheduled_on?: string;
  status?: string;
  sender?: string;
  recipient?: string;
  recipient_id?: string;
  message?: string;
  reply?: string;
}
export interface Directory {
  people: { name: string; role: string; unit?: string; phone?: string }[];
  stats: { homes: number; blocks: number; residents: number };
}
export const acceptsRole = (role: Role, membership: string) =>
  (role === "guard"
    ? ["guard", "admin"]
    : ["owner", "tenant", "family"]
  ).includes(membership);
export function parsePass(input: string, community: string): string {
  let text = input.trim();
  if (text.includes("://")) {
    let uri: URL;
    try {
      uri = new URL(text);
    } catch {
      throw new Error("Please scan a My Home visitor QR code.");
    }
    if (
      !["myhome:", "mycommunity:"].includes(uri.protocol) ||
      uri.hostname !== "pass" ||
      uri.pathname !== "/v1" ||
      uri.hash ||
      uri.username ||
      uri.password ||
      uri.port ||
      uri.searchParams.getAll("code").length !== 1 ||
      uri.searchParams.getAll("community").length !== 1
    )
      throw new Error("Please scan a My Home visitor QR code.");
    if (uri.searchParams.get("community") !== community)
      throw new Error("This pass belongs to a different society.");
    text = uri.searchParams.get("code")!;
  }
  const code = text.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[2-9A-HJ-NP-Z]{12}$/.test(code))
    throw new Error("Enter the 12-character code printed below the QR.");
  return code;
}
export const passPayload = (p: VisitorPass) =>
  `myhome://pass/v1?community=${encodeURIComponent(p.community_id)}&code=${encodeURIComponent(p.code)}`;
export const formatCode = (code: string) =>
  code.match(/.{1,4}/g)?.join("-") ?? code;
export const expired = (p: VisitorPass, now = Date.now()) =>
  Date.parse(p.expires_at) <= now;
export const categories = [
  "Furniture",
  "Food",
  "Services",
  "Home Decor",
  "Electronics",
  "Vehicles",
  "Kids Items",
  "Others",
  "Free",
];
export const money = (n: number) =>
  n === 0 ? "FREE" : `₹ ${Number(n).toLocaleString("en-IN")}`;
export const dateText = (s?: string) =>
  s
    ? new Date(s).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Please try again.";
