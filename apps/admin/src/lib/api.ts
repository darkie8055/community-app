export const API =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:4000/v1";
export type User = { sub: string; name: string; platformAdmin: boolean };
export type Community = {
  id: string;
  name: string;
  address: string;
  city: string;
};
export type Visit = {
  id: string;
  name: string;
  phone: string;
  unit: string;
  unit_id: string;
  type: string;
  status: string;
  company: string;
  purpose: string;
  people: number;
  vehicle: string;
  created_at: string;
  approved_at?: string;
  denied_at?: string;
  entered_at?: string;
  exited_at?: string;
};
export type Member = {
  id: string;
  name: string;
  phone: string;
  unit: string;
  role: string;
  status: string;
  created_at: string;
};
export type Structure = {
  blocks: { id: string; name: string }[];
  floors: { id: string; block_id: string; number: number }[];
  units: {
    id: string;
    floor_id: string;
    label: string;
    block: string;
    floor: number;
    kind: string;
  }[];
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  entity_id: string;
  created_at: string;
};
export type Overview = {
  stats: {
    units: number;
    blocks: number;
    pending_memberships: number;
    residents: number;
    visits_today: number;
    inside: number;
    waiting: number;
  };
  recent: Visit[];
  trend: { label: string; count: number }[];
};
export async function request<T>(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const data = await response
    .json()
    .catch(() => ({ message: "The server returned an unexpected response." }));
  if (!response.ok) {
    if (response.status === 401 && token)
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(". ")
        : data.message || "Could not complete the request.",
    );
  }
  return data;
}
export const time = (value: string) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
export const date = (value: string) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
