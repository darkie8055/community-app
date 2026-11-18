import {
  acceptsRole,
  type Role,
  type Visitor,
  type Membership,
  type Community,
  type Unit,
  type Notice,
  type Page,
} from "./domain";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export interface Snapshot {
  user: { sub: string; name: string; phone: string } | null;
  community: Community | null;
  entries: Visitor[];
  units: Unit[];
  memberships: Membership[];
  notifications: Notice[];
  error: string | null;
}
const empty = (): Snapshot => ({
  user: null,
  community: null,
  entries: [],
  units: [],
  memberships: [],
  notifications: [],
  error: null,
});
/** In-memory server JWT; Firebase persists its own native credentials in platform storage. */
export class Session {
  readonly isDemo: boolean = false;
  snapshot = empty();
  private listeners = new Set<() => void>();
  private token = "";
  private expiry = 0;
  private generation = 0;
  private refreshing?: Promise<void>;
  constructor(
    public origin: string,
    public role: Role,
    private identityToken: () => Promise<string>,
    private transport: typeof fetch = fetch,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private update(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }
  get base() {
    if (!this.snapshot.community)
      throw new Error("Choose an approved society first.");
    return `/v1/communities/${this.snapshot.community.id}`;
  }
  get ownUnits() {
    return this.snapshot.memberships
      .filter(
        (m) =>
          m.status === "approved" &&
          m.unit_id &&
          acceptsRole("resident", m.role),
      )
      .map((m) => ({
        id: m.unit_id!,
        label:
          m.unit ??
          this.snapshot.units.find((u) => u.id === m.unit_id)?.label ??
          "Home",
      }));
  }
  clearCommunity() {
    this.generation++;
    this.update({
      community: null,
      entries: [],
      units: [],
      memberships: [],
      notifications: [],
      error: null,
    });
  }
  clear() {
    this.generation++;
    this.token = "";
    this.expiry = 0;
    this.snapshot = empty();
    this.listeners.forEach((l) => l());
  }
  async request<T>(
    path: string,
    method = "GET",
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<T> {
    const generation = this.generation;
    if (
      path !== "/v1/auth/firebase" &&
      this.token &&
      Date.now() >= this.expiry
    ) {
      this.refreshing ??= this.exchange(this.snapshot.user?.name ?? "").finally(
        () => {
          this.refreshing = undefined;
        },
      );
      await this.refreshing;
    }
    if (generation !== this.generation)
      throw new Error("Your workspace changed. Please try again.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await this.transport(`${this.origin}${path}`, {
        method,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      let data: any;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new ApiError(
          "The server returned an unreadable response.",
          res.status,
        );
      }
      if (!res.ok) {
        if (generation === this.generation && res.status === 401) this.clear();
        throw new ApiError(
          Array.isArray(data?.message)
            ? data.message.join("\n")
            : data?.message || `Request failed (${res.status}).`,
          res.status,
        );
      }
      if (generation !== this.generation)
        throw new Error("Your workspace changed. Please try again.");
      return data as T;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError")
        throw new Error("Connection timed out. Please try again.");
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  private async exchange(name: string) {
    const generation = this.generation;
    const idToken = await this.identityToken();
    if (generation !== this.generation)
      throw new Error("Your sign-in session changed. Please try again.");
    const result = await this.request<{
      access_token: string;
      user: NonNullable<Snapshot["user"]>;
    }>("/v1/auth/firebase", "POST", { id_token: idToken, name });
    if (generation !== this.generation)
      throw new Error("Your sign-in session changed. Please try again.");
    this.token = result.access_token;
    this.expiry = Date.now() + 55 * 60000;
    this.update({ user: result.user });
  }
  async signIn(name: string) {
    const previousCommunity = this.snapshot.community?.id;
    // A newer sign-in attempt invalidates all work from an older identity.
    this.clear();
    await this.exchange(name);
    const grants = await this.request<Membership[]>(
      "/v1/onboarding/memberships",
    );
    const communities = await this.request<Community[]>("/v1/communities");
    const allowed = communities.filter((c) =>
      grants.some(
        (m) =>
          m.community_id === c.id &&
          m.status === "approved" &&
          acceptsRole(this.role, m.role),
      ),
    );
    const selected =
      allowed.find((c) => c.id === previousCommunity) ?? allowed[0];
    if (selected) await this.selectCommunity(selected.id);
    else this.clearCommunity();
  }
  async selectCommunity(id: string) {
    const [communities, grants] = await Promise.all([
      this.request<Community[]>("/v1/communities"),
      this.request<Membership[]>(`/v1/communities/${id}/my-memberships`),
    ]);
    const selected = communities.find((c) => c.id === id);
    if (
      !selected ||
      !grants.some(
        (m) => m.status === "approved" && acceptsRole(this.role, m.role),
      )
    )
      throw new Error("You do not have approved access to this workspace.");
    this.clearCommunity();
    this.update({ community: selected });
    try {
      await this.refresh();
    } catch (e) {
      this.clearCommunity();
      throw e;
    }
  }
  async refresh() {
    if (!this.snapshot.community) return;
    const generation = this.generation;
    try {
      const [visits, structure, notifications, memberships] = await Promise.all(
        [
          this.request<Page<Visitor>>(`${this.base}/visitor-entries?limit=100`),
          this.request<{ units: Unit[] }>(`${this.base}/structure`),
          this.request<Notice[]>("/v1/notifications"),
          this.request<Membership[]>(`${this.base}/my-memberships`),
        ],
      );
      if (generation !== this.generation) return;
      if (
        !memberships.some(
          (m) => m.status === "approved" && acceptsRole(this.role, m.role),
        )
      ) {
        this.clearCommunity();
        return;
      }
      this.update({
        entries: visits.items,
        units: structure.units,
        notifications,
        memberships,
        error: null,
      });
    } catch (e) {
      if (generation !== this.generation) return;
      if (e instanceof ApiError && e.status === 403) this.clearCommunity();
      else
        this.update({
          error:
            "Connection interrupted. Showing your last loaded visits. Pull down to retry.",
        });
      throw e;
    }
  }
  async transition(id: string, status: string) {
    const action = ["approved", "denied"].includes(status)
      ? "decision"
      : status === "inside"
        ? "check-in"
        : "check-out";
    await this.request(
      `${this.base}/visitor-entries/${id}/${action}`,
      "POST",
      action === "decision" ? { decision: status } : undefined,
    );
    await this.refresh();
  }
  async register(body: object, key: string) {
    const visit = await this.request<Visitor>(
      `${this.base}/visitor-entries`,
      "POST",
      body,
      { "Idempotency-Key": key },
    );
    this.update({
      entries: [
        visit,
        ...this.snapshot.entries.filter((v) => v.id !== visit.id),
      ],
    });
    return visit;
  }
  async upload(uri: string, contentType: string) {
    const photo = await (await this.transport(uri)).blob();
    if (photo.size > 2 * 1024 * 1024)
      throw new Error("Choose a photo smaller than 2 MB.");
    const upload = await this.request<{ url: string; key: string }>(
      `${this.base}/uploads`,
      "POST",
      { content_type: contentType, size: photo.size },
    );
    const res = await this.transport(upload.url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: photo,
    });
    if (!res.ok) throw new Error("Photo upload failed. Please retry.");
    return upload.key;
  }
}
