import { Session } from "./api";
import {
  parsePass,
  type Activity,
  type Community,
  type Item,
  type Kind,
  type Membership,
  type Notice,
  type Page,
  type Role,
  type Unit,
  type Visitor,
  type VisitorPass,
} from "./domain";

/** These identities and records belong only to this local presentation workspace. */
export const DEMO_DETAILS = {
  communityId: "11111111-1111-4111-8111-111111111111",
  residentName: "Ananya Sharma",
  guardName: "Ravi Kumar",
  passCode: "ABCD2345EFGH",
} as const;
export const DEMO_PASS_CODE = DEMO_DETAILS.passCode;
const origin = "https://demo.myhome.invalid";
const residentId = "22222222-2222-4222-8222-222222222222";
const guardId = "33333333-3333-4333-8333-333333333333";
const neighbourId = "44444444-4444-4444-8444-444444444444";
const id = (n: number) =>
  `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;
const community: Community = {
  id: DEMO_DETAILS.communityId,
  name: "Maple Grove",
  city: "Bengaluru",
};
const units: Unit[] = [
  { id: id(1), label: "A-101" },
  { id: id(2), label: "A-102" },
  { id: id(3), label: "B-201" },
  { id: id(4), label: "B-202" },
];
const iso = (offset = 0) => new Date(Date.now() + offset).toISOString();
const date = (days: number) => iso(days * 86400000).slice(0, 10);
const userId = (role: Role) => (role === "resident" ? residentId : guardId);
const displayName = (role: Role) =>
  role === "resident" ? DEMO_DETAILS.residentName : DEMO_DETAILS.guardName;
type DemoActivity = Activity & { owner_id: string; sender_id?: string };
type DemoState = {
  sequence: number;
  names: Record<Role, string>;
  visitors: Visitor[];
  items: Item[];
  passes: Map<string, VisitorPass>;
  memberships: Record<Role, Membership[]>;
  saved: Record<Role, Set<string>>;
  notifications: Record<Role, Notice[]>;
  inquiries: DemoActivity[];
  requests: DemoActivity[];
  intents: Map<string, { body: string; visitorId: string }>;
};

function freshState(): DemoState {
  const visit = (
    n: number,
    name: string,
    type: Visitor["type"],
    status: Visitor["status"],
    minutes: number,
    extras: Partial<Visitor> = {},
  ): Visitor => ({
    id: id(n),
    community_id: community.id,
    unit_id: units[0].id,
    unit: units[0].label,
    name,
    phone: `900000${String(n).padStart(4, "0")}`,
    type,
    status,
    people: 1,
    created_at: iso(-minutes * 60000),
    ...extras,
  });
  const item = (
    n: number,
    kind: Kind,
    title: string,
    description: string,
    category: string,
    price: number,
    extras: Partial<Item> = {},
  ): Item => ({
    id: id(n),
    kind,
    title,
    description,
    category,
    price,
    author: "Meera Rao",
    author_id: neighbourId,
    community: community.name,
    status: "published",
    saved: false,
    comments: [],
    ...extras,
  });
  return {
    sequence: 1000,
    names: { resident: displayName("resident"), guard: displayName("guard") },
    visitors: [
      visit(10, "Aarav Patel", "delivery", "pending", 4, {
        company: "Fresh Basket",
        purpose: "Grocery delivery",
      }),
      visit(11, "Priya Mehta", "guest", "approved", 15, {
        people: 2,
        purpose: "An evening with friends",
        approved_at: iso(-14 * 60000),
      }),
      visit(12, "Neeraj Verma", "service", "inside", 70, {
        company: "HomeCare",
        purpose: "Air-conditioner service",
        approved_at: iso(-69 * 60000),
        entered_at: iso(-65 * 60000),
      }),
      visit(13, "Sameer Shah", "cab", "exited", 150, {
        vehicle: "KA 01 AB 2345",
        approved_at: iso(-149 * 60000),
        entered_at: iso(-148 * 60000),
        exited_at: iso(-140 * 60000),
      }),
      visit(14, "Kiran Das", "delivery", "denied", 1440, {
        company: "Parcel delivery",
        denied_at: iso(-1438 * 60000),
      }),
      visit(15, "Aditya Nair", "guest", "approved", 35, {
        unit_id: units[2].id,
        unit: units[2].label,
        approved_at: iso(-30 * 60000),
      }),
    ],
    items: [
      item(
        100,
        "property",
        "A bright 2 BHK overlooking the garden",
        "A sunny, well-ventilated home with two balconies, covered parking and a view of the central garden. Available for a family to move in next month.",
        "Rent",
        28000,
        {
          unit: "B-201",
          photo_url: "sample:apartment",
          bedrooms: 2,
          listing_type: "rent",
          available_on: date(14),
        },
      ),
      item(
        101,
        "property",
        "Spacious 3 BHK corner home",
        "A peaceful corner apartment with a large living room, three bedrooms and two parking spaces. Meet the owner and explore your next home within Maple Grove.",
        "Buy",
        9200000,
        {
          unit: "B-202",
          photo_url: "sample:garden",
          bedrooms: 3,
          listing_type: "sell",
          available_on: date(30),
        },
      ),
      item(
        102,
        "listing",
        "Solid wood reading chair",
        "A comfortable teak reading chair in excellent condition. It has been a lovely corner for books and coffee. Collection from B-201.",
        "Furniture",
        3500,
        { photo_url: "sample:chair" },
      ),
      item(
        103,
        "listing",
        "Children’s bicycle",
        "A gently used 16-inch bicycle with training wheels. Ideal for a child aged four to seven. Happy to help another little cyclist get started.",
        "Kids Items",
        1800,
        { author: "Rahul Menon", photo_url: "sample:bicycle" },
      ),
      item(
        104,
        "listing",
        "A few plants for a new balcony",
        "Three healthy pothos cuttings in small pots, ready for a neighbour’s balcony. Free to a good home.",
        "Free",
        0,
        { photo_url: "sample:plant" },
      ),
      item(
        105,
        "listing",
        "Bookshelf looking for a new home",
        "A compact oak-finish bookshelf with four shelves. Clean and sturdy, with plenty of room for your favourite reads.",
        "Furniture",
        2200,
        {
          author: DEMO_DETAILS.residentName,
          author_id: residentId,
          photo_url: "sample:bookcase",
        },
      ),
      item(
        106,
        "listing",
        "Weekend picnic basket",
        "Draft listing: a woven picnic basket with a washable lining, ready for your next afternoon in the park.",
        "Others",
        900,
        {
          author: DEMO_DETAILS.residentName,
          author_id: residentId,
          status: "draft",
        },
      ),
      item(
        110,
        "service",
        "Home deep cleaning",
        "A professional cleaning visit for your living room, bedrooms, kitchen and bathrooms. Select a preferred date; the society team will confirm availability and the final price.",
        "Cleaning",
        2499,
        { author: "Maple Grove Services", photo_url: "sample:cleaning" },
      ),
      item(
        111,
        "service",
        "AC servicing and care",
        "Seasonal filter cleaning, cooling checks and routine air-conditioner maintenance by the society’s service partner.",
        "Appliance Repair",
        599,
        { author: "Maple Grove Services", photo_url: "sample:ac" },
      ),
      item(
        112,
        "service",
        "A fresh coat of paint",
        "Refresh a room or plan a complete home repaint. Request a site visit to discuss colours, preparation and a detailed estimate.",
        "Painting",
        0,
        { author: "Maple Grove Services" },
      ),
      item(
        120,
        "notice",
        "Weekend community breakfast",
        "Join your neighbours at the clubhouse this Sunday, 9–11 am. Bring a favourite breakfast dish if you like. Everyone is welcome, including our newest residents.",
        "Community",
        0,
        { author: "Society Office" },
      ),
      item(
        121,
        "notice",
        "Water tank cleaning on Saturday",
        "The maintenance team will clean the overhead tanks from 10 am to noon this Saturday. Please store a little water in advance. Thank you for helping keep our community well cared for.",
        "Maintenance",
        0,
        { author: "Society Office" },
      ),
      item(
        130,
        "post",
        "Anyone up for an evening walking group?",
        "I’m starting a relaxed walk around the garden at 6:30 pm on weekdays. All paces welcome! Leave a comment if you would like to join.",
        "Community",
        0,
        {
          comments: [
            {
              id: id(131),
              author: "Rahul Menon",
              body: "Count me in. See you by the garden gate!",
            },
          ],
        },
      ),
      item(
        132,
        "post",
        "Thank you for the book exchange",
        "It was lovely meeting everyone at the clubhouse. The children have already started their new books. Let’s do this again next month!",
        "Community",
        0,
        { author: DEMO_DETAILS.residentName, author_id: residentId },
      ),
    ],
    passes: new Map([
      [
        id(11),
        {
          entry_id: id(11),
          community_id: community.id,
          code: DEMO_DETAILS.passCode,
          expires_at: iso(24 * 3600000),
        },
      ],
    ]),
    memberships: {
      resident: [
        {
          id: id(20),
          community_id: community.id,
          unit_id: units[0].id,
          unit: units[0].label,
          role: "owner",
          status: "approved",
        },
      ],
      guard: [
        {
          id: id(21),
          community_id: community.id,
          role: "guard",
          status: "approved",
        },
      ],
    },
    saved: { resident: new Set([id(100), id(103)]), guard: new Set() },
    notifications: {
      resident: [
        {
          id: id(30),
          title: "Your delivery is at the gate",
          body: "Aarav from Fresh Basket is waiting for your approval.",
          entry_id: id(10),
          created_at: iso(-4 * 60000),
        },
        {
          id: id(31),
          title: "Welcome to Maple Grove",
          body: "Your home, your neighbours and your everyday, all in one place.",
          created_at: iso(-86400000),
          read_at: iso(-3600000),
        },
      ],
      guard: [
        {
          id: id(32),
          title: "Guest expected today",
          body: "Priya Mehta has a pre-approved visit to A-101.",
          entry_id: id(11),
          created_at: iso(-15 * 60000),
        },
      ],
    },
    inquiries: [
      {
        id: id(40),
        title: "Bookshelf looking for a new home",
        owner_id: residentId,
        sender_id: neighbourId,
        recipient_id: residentId,
        sender: "Meera Rao",
        recipient: DEMO_DETAILS.residentName,
        message:
          "Is the bookshelf still available? I could collect it this weekend.",
      },
      {
        id: id(41),
        title: "Solid wood reading chair",
        owner_id: residentId,
        sender_id: residentId,
        recipient_id: neighbourId,
        sender: DEMO_DETAILS.residentName,
        recipient: "Meera Rao",
        message: "Could I have a look at the chair tomorrow?",
        reply: "Of course! After 6 pm works well. I’m in B-201.",
      },
    ],
    requests: [
      {
        id: id(50),
        title: "AC servicing and care",
        owner_id: residentId,
        unit: "A-101",
        scheduled_on: date(2),
        status: "accepted",
        message: "Please check the bedroom AC.",
      },
    ],
    intents: new Map(),
  };
}

class DemoError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
function ensure(value: unknown, message: string, status = 400): asserts value {
  if (!value) throw new DemoError(message, status);
}
function paginate<T extends { id: string }>(
  rows: T[],
  query: URLSearchParams,
): Page<T> {
  const limit = Math.max(1, Math.min(100, Number(query.get("limit")) || 50));
  const cursor = query.get("cursor");
  const start = cursor ? rows.findIndex((row) => row.id === cursor) + 1 : 0;
  const items = rows.slice(start, start + limit);
  return {
    items,
    next_cursor:
      start + limit < rows.length ? (items.at(-1)?.id ?? null) : null,
  };
}

/** A Session-compatible adapter: all data stays in memory and no HTTP is sent. */
export class DemoSession extends Session {
  override readonly isDemo = true;
  override async upload(uri: string, _contentType: string) {
    ensure(
      /^(file:|content:|blob:|data:image\/|ph:|assets-library:)/i.test(uri),
      "Choose a photo from this device for the demo.",
    );
    return uri;
  }
}

export function createDemoWorkspace(): {
  session: (role: Role) => DemoSession;
  reset: () => void;
} {
  let state = freshState();
  const sessions = new Map<Role, DemoSession>();
  const nextId = () => id(++state.sequence);
  const ownUnit = (role: Role, unitId: string) =>
    role === "guard" ||
    state.memberships.resident.some(
      (m) => m.unit_id === unitId && m.status === "approved",
    );
  const visibleVisitor = (role: Role, visitorId: string) => {
    const visitor = state.visitors.find(
      (v) => v.id === visitorId && ownUnit(role, v.unit_id),
    );
    ensure(visitor, "This visitor was not found in your demo workspace.", 404);
    return visitor;
  };
  const notify = (title: string, body: string, entry_id?: string) => {
    for (const role of ["resident", "guard"] as const)
      state.notifications[role].unshift({
        id: nextId(),
        title,
        body,
        entry_id,
        created_at: iso(),
      });
  };
  const presentItem = (item: Item, role: Role): Item => ({
    ...item,
    saved: state.saved[role].has(item.id),
  });
  const requireResident = (role: Role) =>
    ensure(role === "resident", "This action needs the resident demo.", 403);
  const requireGuard = (role: Role) =>
    ensure(role === "guard", "This action needs the guard demo.", 403);
  const passVisitor = (code: unknown) => {
    const normalized = parsePass(String(code ?? ""), community.id);
    const pass = [...state.passes.values()].find((p) => p.code === normalized);
    ensure(
      pass && Date.parse(pass.expires_at) > Date.now(),
      "This demo pass is invalid, expired or revoked.",
      404,
    );
    const visitor = visibleVisitor("guard", pass.entry_id);
    ensure(
      visitor.status === "approved",
      "This pass has already been used or the visit is no longer approved.",
      409,
    );
    return visitor;
  };
  function route(
    role: Role,
    url: URL,
    method: string,
    body: any,
    headers: Headers,
  ): unknown {
    const path = url.pathname;
    const query = url.searchParams;
    const name = state.names[role];
    if (path === "/v1/auth/firebase" && method === "POST") {
      state.names[role] = String(body.name || displayName(role));
      return {
        access_token: `local-presentation-${role}`,
        user: {
          sub: userId(role),
          name: state.names[role],
          phone: role === "resident" ? "9000000001" : "9000000002",
        },
      };
    }
    if (
      (path === "/v1/communities" || path === "/v1/onboarding/communities") &&
      method === "GET"
    )
      return community.name
        .toLowerCase()
        .includes((query.get("search") ?? "").toLowerCase())
        ? [community]
        : [];
    if (path === "/v1/onboarding/memberships" && method === "GET")
      return state.memberships[role];
    if (
      path === `/v1/onboarding/communities/${community.id}/units` &&
      method === "GET"
    )
      return units;
    if (path === "/v1/notifications" && method === "GET")
      return state.notifications[role];
    if (path === "/v1/notifications/read" && method === "POST") {
      state.notifications[role].forEach((n) => {
        n.read_at ??= iso();
      });
      return { ok: true };
    }
    const prefix = `/v1/communities/${community.id}/`;
    ensure(
      path.startsWith(prefix),
      "This route is not available in the local demo.",
      404,
    );
    const parts = path.slice(prefix.length).split("/");
    const [resource, resourceId, action] = parts;
    if (resource === "my-memberships" && method === "GET")
      return state.memberships[role];
    if (resource === "structure" && method === "GET") return { units };
    if (resource === "directory" && method === "GET")
      return {
        people: [
          { name: state.names.resident, role: "owner", unit: "A-101" },
          { name: "Meera Rao", role: "owner", unit: "B-201" },
          { name: "Rahul Menon", role: "tenant", unit: "B-202" },
          { name: state.names.guard, role: "guard" },
          { name: "Society Office", role: "admin" },
        ],
        stats: { homes: 48, blocks: 2, residents: 126 },
      };
    if (resource === "memberships" && method === "POST") {
      requireResident(role);
      const unit = units.find((u) => u.id === body.unit_id);
      ensure(unit, "Select a demo flat.");
      ensure(
        ["owner", "tenant", "family"].includes(body.role),
        "Select a resident membership type.",
      );
      const existing = state.memberships[role].find(
        (m) => m.unit_id === unit.id,
      );
      if (existing) return existing;
      const membership: Membership = {
        id: nextId(),
        community_id: community.id,
        unit_id: unit.id,
        unit: unit.label,
        role: body.role,
        status: "pending",
      };
      state.memberships[role].push(membership);
      return membership;
    }
    if (resource === "visitor-entries" && !resourceId) {
      if (method === "GET") {
        const search = (query.get("search") ?? "").toLowerCase();
        const filtered = state.visitors.filter(
          (v) =>
            ownUnit(role, v.unit_id) &&
            `${v.name} ${v.phone} ${v.unit} ${v.company ?? ""}`
              .toLowerCase()
              .includes(search) &&
            (!query.get("status") || query.get("status") === v.status) &&
            (!query.get("type") || query.get("type") === v.type) &&
            (!query.get("from") ||
              Date.parse(v.created_at) >= Date.parse(query.get("from")!)) &&
            (!query.get("until") ||
              Date.parse(v.created_at) < Date.parse(query.get("until")!)),
        );
        return paginate(filtered, query);
      }
      if (method === "POST") {
        const key = headers.get("Idempotency-Key");
        const intentKey = `${role}:${key}`;
        const previous = key && state.intents.get(intentKey);
        if (previous) {
          ensure(
            previous.body === JSON.stringify(body),
            "This submission key was already used for a different visitor.",
            409,
          );
          return visibleVisitor(role, previous.visitorId);
        }
        const unit = units.find((u) => u.id === body.unit_id);
        ensure(
          unit && ownUnit(role, unit.id),
          "Choose an approved demo home.",
          403,
        );
        ensure(
          String(body.name ?? "").trim().length >= 2 &&
            /^[6-9]\d{9}$/.test(String(body.phone)),
          "Enter a name and valid mobile number.",
        );
        ensure(
          ["guest", "delivery", "cab", "service"].includes(body.type),
          "Choose a visitor type.",
        );
        ensure(
          Number.isInteger(body.people) &&
            body.people >= 1 &&
            body.people <= 20,
          "Choose a party size from 1 to 20.",
        );
        ensure(
          !body.preapproved || role === "resident",
          "Only residents can pre-approve a visit.",
          403,
        );
        const visitor: Visitor = {
          id: nextId(),
          community_id: community.id,
          unit_id: unit.id,
          unit: unit.label,
          name: String(body.name).trim(),
          phone: body.phone,
          people: body.people,
          type: body.type,
          status: body.preapproved ? "approved" : "pending",
          created_at: iso(),
          ...(body.preapproved ? { approved_at: iso() } : {}),
          company: body.company,
          purpose: body.purpose,
          vehicle: body.vehicle,
          photo_url: body.photo_key,
        };
        state.visitors.unshift(visitor);
        if (key)
          state.intents.set(intentKey, {
            body: JSON.stringify(body),
            visitorId: visitor.id,
          });
        notify(
          body.preapproved ? "Guest invited" : "A visitor is at the gate",
          `${visitor.name} · ${visitor.unit}`,
          visitor.id,
        );
        return visitor;
      }
    }
    if (resource === "visitor-entries" && resourceId) {
      const visitor = visibleVisitor(role, resourceId);
      if (!action && method === "GET") return visitor;
      if (action === "pass") {
        requireResident(role);
        if (method === "GET") return state.passes.get(visitor.id) ?? null;
        if (method === "DELETE") {
          state.passes.delete(visitor.id);
          return { ok: true };
        }
        if (method === "POST") {
          ensure(
            visitor.status === "approved",
            "Only approved visitors can receive a pass.",
            409,
          );
          const hours = Number(body.hours ?? 24);
          ensure(
            Number.isInteger(hours) && hours >= 1 && hours <= 48,
            "Choose an expiry from 1 to 48 hours.",
          );
          const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
          let number = ++state.sequence;
          let suffix = "";
          for (let index = 0; index < 8; index++) {
            suffix = alphabet[number % alphabet.length] + suffix;
            number = Math.floor(number / alphabet.length);
          }
          const pass: VisitorPass = {
            entry_id: visitor.id,
            community_id: community.id,
            code: `DEMO${suffix}`.replace("O", "P"),
            expires_at: iso(hours * 3600000),
          };
          state.passes.set(visitor.id, pass);
          return pass;
        }
      }
      if (action === "decision" && method === "POST") {
        requireResident(role);
        ensure(
          visitor.status === "pending",
          "This visitor already has a decision.",
          409,
        );
        ensure(
          ["approved", "denied"].includes(body.decision),
          "Choose approve or deny.",
        );
        visitor.status = body.decision;
        if (visitor.status === "approved") visitor.approved_at = iso();
        else visitor.denied_at = iso();
        notify(
          visitor.status === "approved" ? "Visitor approved" : "Visitor denied",
          `${visitor.name} · ${visitor.unit}`,
          visitor.id,
        );
        return visitor;
      }
      if (["check-in", "check-out"].includes(action) && method === "POST") {
        requireGuard(role);
        ensure(
          visitor.status === (action === "check-in" ? "approved" : "inside"),
          "This visitor cannot make that transition.",
          409,
        );
        if (action === "check-in") {
          visitor.status = "inside";
          visitor.entered_at = iso();
        } else {
          visitor.status = "exited";
          visitor.exited_at = iso();
        }
        state.passes.delete(visitor.id);
        notify(
          action === "check-in" ? "Visitor checked in" : "Visitor checked out",
          `${visitor.name} · ${visitor.unit}`,
          visitor.id,
        );
        return visitor;
      }
    }
    if (
      resource === "visitor-passes" &&
      ["verify", "check-in"].includes(resourceId) &&
      method === "POST"
    ) {
      requireGuard(role);
      const visitor = passVisitor(body.code);
      if (resourceId === "check-in") {
        visitor.status = "inside";
        visitor.entered_at = iso();
        state.passes.delete(visitor.id);
        notify(
          "Guest checked in",
          `${visitor.name} arrived using their visitor pass.`,
          visitor.id,
        );
      }
      return visitor;
    }
    if (resource === "items" && !resourceId) {
      if (method === "GET") {
        const search = (query.get("search") ?? "").toLowerCase();
        return paginate(
          state.items
            .filter(
              (item) =>
                (query.get("mine") === "true"
                  ? item.author_id === userId(role)
                  : item.status === "published") &&
                (!query.get("kind") || query.get("kind") === item.kind) &&
                (!query.get("category") ||
                  query.get("category") === item.category) &&
                (query.get("saved") !== "true" ||
                  state.saved[role].has(item.id)) &&
                `${item.title} ${item.description} ${item.author}`
                  .toLowerCase()
                  .includes(search),
            )
            .map((item) => presentItem(item, role)),
          query,
        );
      }
      if (method === "POST") {
        requireResident(role);
        ensure(
          ["listing", "property", "post"].includes(body.kind),
          "This item type is managed by your society.",
          403,
        );
        ensure(
          String(body.title ?? "").trim().length >= 3 &&
            String(body.description ?? "").trim().length >= 3,
          "Add a title and description.",
        );
        ensure(
          Number.isInteger(body.price) && body.price >= 0,
          "Enter a valid price.",
        );
        ensure(
          ["draft", "published"].includes(body.status),
          "Choose draft or published.",
        );
        const unit = units.find((u) => u.id === body.unit_id);
        if (body.kind === "property")
          ensure(
            unit && ownUnit(role, unit.id),
            "Choose your own demo property.",
            403,
          );
        const item: Item = {
          id: nextId(),
          kind: body.kind,
          title: String(body.title).trim(),
          description: String(body.description).trim(),
          category: body.category,
          price: body.price,
          author: name,
          author_id: userId(role),
          community: community.name,
          status: body.status,
          saved: false,
          comments: [],
          unit: unit?.label,
          bedrooms: body.bedrooms,
          listing_type: body.listing_type,
          available_on: body.available_on,
          photo_url: body.photo_key,
        };
        state.items.unshift(item);
        return item;
      }
    }
    if (resource === "items" && resourceId) {
      const item = state.items.find(
        (i) =>
          i.id === resourceId &&
          (i.status === "published" || i.author_id === userId(role)),
      );
      ensure(item, "This item was not found in your demo workspace.", 404);
      if (!action && method === "GET") return presentItem(item, role);
      if (method === "POST") {
        if (action === "bookmark") {
          if (state.saved[role].has(item.id)) state.saved[role].delete(item.id);
          else state.saved[role].add(item.id);
          return presentItem(item, role);
        }
        if (action === "status") {
          ensure(
            item.author_id === userId(role),
            "Only the author can change this listing.",
            403,
          );
          ensure(
            ["published", "closed"].includes(body.status),
            "Choose published or closed.",
          );
          item.status = body.status;
          return presentItem(item, role);
        }
        if (action === "comments") {
          ensure(
            ["post", "notice"].includes(item.kind),
            "Comments belong to posts and notices.",
          );
          ensure(
            String(body.message ?? "").trim().length >= 2,
            "Please write a comment.",
          );
          item.comments ??= [];
          item.comments.push({
            id: nextId(),
            author: name,
            body: String(body.message).trim(),
          });
          return presentItem(item, role);
        }
        if (action === "inquiries") {
          requireResident(role);
          ensure(
            ["property", "listing"].includes(item.kind) &&
              item.author_id !== userId(role),
            "Choose another resident’s listing.",
          );
          ensure(
            String(body.message ?? "").trim().length >= 2,
            "Please write an enquiry.",
          );
          const inquiry: DemoActivity = {
            id: nextId(),
            title: item.title,
            owner_id: userId(role),
            sender_id: userId(role),
            sender: name,
            recipient: item.author,
            recipient_id: item.author_id,
            message: String(body.message).trim(),
          };
          state.inquiries.unshift(inquiry);
          return inquiry;
        }
        if (action === "requests") {
          requireResident(role);
          const unit = units.find((u) => u.id === body.unit_id);
          ensure(
            item.kind === "service" && unit && ownUnit(role, unit.id),
            "Select a service and your approved home.",
          );
          ensure(
            /^\d{4}-\d{2}-\d{2}$/.test(String(body.scheduled_on)) &&
              !Number.isNaN(Date.parse(body.scheduled_on)),
            "Choose a valid preferred date.",
          );
          const request: DemoActivity = {
            id: nextId(),
            title: item.title,
            owner_id: userId(role),
            unit: unit.label,
            scheduled_on: body.scheduled_on,
            status: "requested",
            message: String(body.note ?? ""),
          };
          state.requests.unshift(request);
          return request;
        }
      }
    }
    if (resource === "inquiries") {
      if (!resourceId && method === "GET")
        return state.inquiries.filter(
          (i) =>
            i.sender_id === userId(role) || i.recipient_id === userId(role),
        );
      if (action === "reply" && method === "POST") {
        const inquiry = state.inquiries.find(
          (i) => i.id === resourceId && i.recipient_id === userId(role),
        );
        ensure(inquiry, "Only the recipient can reply to this enquiry.", 403);
        ensure(
          String(body.message ?? "").trim().length >= 2,
          "Please write a reply.",
        );
        inquiry.reply = String(body.message).trim();
        return inquiry;
      }
    }
    if (resource === "service-requests") {
      if (!resourceId && method === "GET")
        return state.requests.filter((r) => r.owner_id === userId(role));
      if (action === "status" && method === "POST") {
        const request = state.requests.find(
          (r) => r.id === resourceId && r.owner_id === userId(role),
        );
        ensure(request, "This request was not found.", 404);
        ensure(
          body.status === "cancelled" &&
            ["requested", "accepted"].includes(request.status ?? ""),
          "This request can no longer be cancelled.",
          409,
        );
        request.status = "cancelled";
        return request;
      }
    }
    throw new DemoError("This action is not available in the local demo.", 404);
  }
  const transport =
    (role: Role): typeof fetch =>
    async (input, init) => {
      try {
        const url = new URL(String(input));
        ensure(
          url.origin === origin,
          "The demo does not contact external services.",
          403,
        );
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const result = route(
          role,
          url,
          init?.method ?? "GET",
          body,
          new Headers(init?.headers),
        );
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            message:
              error instanceof Error
                ? error.message
                : "Unable to complete this demo action.",
          }),
          { status: error instanceof DemoError ? error.status : 400 },
        );
      }
    };
  return {
    session(role) {
      let session = sessions.get(role);
      if (!session) {
        session = new DemoSession(
          origin,
          role,
          async () => "local-presentation-identity",
          transport(role),
        );
        sessions.set(role, session);
      }
      return session;
    },
    reset() {
      state = freshState();
      sessions.forEach((session) => session.clear());
    },
  };
}
